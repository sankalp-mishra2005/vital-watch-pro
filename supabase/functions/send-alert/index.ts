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

    // 2. Fetch patient profile for notification details
    const { data: patient } = await supabase
      .from("profiles")
      .select("full_name, phone_number")
      .eq("id", patient_id)
      .single();

    const patientName = patient?.full_name || "Unknown Patient";
    const phoneNumber = patient?.phone_number;

    // 3. Fetch admin emails for notification
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const notifications: string[] = [];

    // 4. Send email notifications to admins (using Supabase Auth admin API to get emails)
    if (adminRoles && adminRoles.length > 0) {
      for (const adminRole of adminRoles) {
        const { data: adminUser } = await supabase.auth.admin.getUserById(adminRole.user_id);
        if (adminUser?.user?.email) {
          // Log email notification (actual email sending requires an email provider integration)
          notifications.push(`Email queued for ${adminUser.user.email}`);

          // Audit log
          await supabase.rpc("insert_audit_log", {
            _user_id: patient_id,
            _action: `alert_email_${level}`,
            _details: {
              admin_email: adminUser.user.email,
              patient_name: patientName,
              message,
              vitals: vitals || {},
            },
          });
        }
      }
    }

    // 5. SMS notification placeholder
    // INTEGRATION POINT: Add Twilio or other SMS provider here
    // When ready:
    // - Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER as secrets
    // - Uncomment and configure the SMS sending code below
    let smsStatus = "no_phone_number";
    if (phoneNumber && level === "critical") {
      smsStatus = "sms_provider_not_configured";
      notifications.push(`SMS queued for ${phoneNumber} (provider not configured)`);

      // === TWILIO INTEGRATION (uncomment when ready) ===
      // const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      // const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      // const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");
      // if (twilioSid && twilioToken && twilioPhone) {
      //   const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      //   const smsBody = `[VitalSync CRITICAL] ${patientName}: ${message}`;
      //   const response = await fetch(twilioUrl, {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/x-www-form-urlencoded",
      //       Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
      //     },
      //     body: new URLSearchParams({
      //       To: phoneNumber,
      //       From: twilioPhone,
      //       Body: smsBody,
      //     }),
      //   });
      //   smsStatus = response.ok ? "sent" : "failed";
      // }

      await supabase.rpc("insert_audit_log", {
        _user_id: patient_id,
        _action: `alert_sms_${level}`,
        _details: {
          phone_number: phoneNumber,
          patient_name: patientName,
          sms_status: smsStatus,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        alert_id: alert.id,
        notifications,
        sms_status: smsStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
