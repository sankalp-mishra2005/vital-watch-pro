import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AlertPayload {
  patient_id: string;
  message: string;
  level: "warning" | "critical";
  vitals?: {
    heart_rate?: number;
    spo2?: number;
    temperature?: number;
    motion_status?: string;
  };
}

async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  apiKey: string
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "VitalSync Alerts <alerts@vitalsync.dev>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend API error [${res.status}]: ${body}`);
      return false;
    }
    await res.json();
    return true;
  } catch (err) {
    console.error("Resend send failed:", err);
    return false;
  }
}

async function sendTwilioSms(
  to: string,
  body: string,
  accountSid: string,
  authToken: string,
  fromNumber: string
): Promise<boolean> {
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
      body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
    });
    if (!res.ok) {
      const resBody = await res.text();
      console.error(`Twilio API error [${res.status}]: ${resBody}`);
      return false;
    }
    await res.json();
    return true;
  } catch (err) {
    console.error("Twilio send failed:", err);
    return false;
  }
}

function buildEmailHtml(
  patientName: string,
  level: string,
  message: string,
  vitals?: AlertPayload["vitals"]
): string {
  const timestamp = new Date().toLocaleString("en-US", { timeZone: "UTC" });
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${level === "critical" ? "#dc2626" : "#f59e0b"}; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">⚠️ ${level.toUpperCase()} ALERT – ${patientName}</h1>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <p style="margin: 0 0 16px;"><strong>Alert:</strong> ${message}</p>
        ${vitals ? `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; font-weight: 600;">Heart Rate</td>
              <td style="padding: 8px 0;">${vitals.heart_rate ?? "N/A"} BPM</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; font-weight: 600;">SpO₂</td>
              <td style="padding: 8px 0;">${vitals.spo2 ?? "N/A"}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 8px 0; font-weight: 600;">Temperature</td>
              <td style="padding: 8px 0;">${vitals.temperature ?? "N/A"}°C</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Motion</td>
              <td style="padding: 8px 0;">${vitals.motion_status ?? "N/A"}</td>
            </tr>
          </table>
        ` : ""}
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Time: ${timestamp} UTC</p>
      </div>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: AlertPayload = await req.json();
    const { patient_id, message, level, vitals } = payload;

    if (!patient_id || !message || !level) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patient_id, message, level" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Insert alert into DB
    const { data: alert, error: alertError } = await supabase
      .from("alerts")
      .insert({ patient_id, message, level })
      .select()
      .single();

    if (alertError) {
      throw new Error(`Failed to insert alert: ${alertError.message}`);
    }

    // 2. Fetch patient profile
    const { data: patient } = await supabase
      .from("profiles")
      .select("full_name, phone_number")
      .eq("id", patient_id)
      .single();

    const patientName = patient?.full_name || "Unknown Patient";
    const phoneNumber = patient?.phone_number;

    let emailSent = false;
    let smsSent = false;

    // 3. Send email to all admins via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminRoles && adminRoles.length > 0) {
        const subject = `${level.toUpperCase()} ALERT – ${patientName}`;
        const html = buildEmailHtml(patientName, level, message, vitals);

        for (const adminRole of adminRoles) {
          const { data: adminUser } = await supabase.auth.admin.getUserById(adminRole.user_id);
          if (adminUser?.user?.email) {
            const sent = await sendResendEmail(adminUser.user.email, subject, html, resendApiKey);
            if (sent) emailSent = true;

            await supabase.rpc("insert_audit_log", {
              _user_id: patient_id,
              _action: `alert_email_${level}`,
              _details: {
                admin_email: adminUser.user.email,
                patient_name: patientName,
                email_sent: sent,
                message,
              },
            });
          }
        }
      }
    } else {
      console.warn("RESEND_API_KEY not configured — skipping email notifications");
    }

    // 4. Send SMS via Twilio (critical alerts only)
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (twilioSid && twilioToken && twilioPhone && phoneNumber && level === "critical") {
      const smsBody = `[VitalSync CRITICAL] ${patientName}: ${message}`;
      smsSent = await sendTwilioSms(phoneNumber, smsBody, twilioSid, twilioToken, twilioPhone);

      await supabase.rpc("insert_audit_log", {
        _user_id: patient_id,
        _action: "alert_sms_critical",
        _details: {
          phone_number: phoneNumber,
          patient_name: patientName,
          sms_sent: smsSent,
        },
      });
    } else if (level === "critical" && !twilioSid) {
      console.warn("Twilio credentials not configured — skipping SMS");
    }

    // 5. Update alert with notification status
    await supabase
      .from("alerts")
      .update({ notified_email: emailSent, notified_sms: smsSent })
      .eq("id", alert.id);

    return new Response(
      JSON.stringify({
        success: true,
        alert_id: alert.id,
        email_sent: emailSent,
        sms_sent: smsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-alert error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
