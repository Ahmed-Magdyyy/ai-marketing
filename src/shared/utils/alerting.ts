// ─────────────────────────────────────────────────────────────────
// Alerting Utility
// Sends alerts to Slack if configured
// ─────────────────────────────────────────────────────────────────

import { logger } from "./logger";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AlertPayload {
  message: string;
  severity: AlertSeverity;
  context?: Record<string, unknown>;
}

/**
 * Sends an alert to Slack if configured.
 * Always logs the alert locally.
 */
export const sendAlert = async (
  type:
    | "KillSwitchFired"
    | "HighErrorRate"
    | "CostThresholdExceeded"
    | "SystemDegraded"
    | "HealthCheckFailed",
  payload: AlertPayload,
): Promise<void> => {
  const alertMsg = `[ALERT - ${type}] ${payload.message}`;

  // Log locally based on severity
  if (payload.severity === "CRITICAL") {
    logger.error(alertMsg, payload.context);
  } else if (payload.severity === "WARNING") {
    logger.warn(alertMsg, payload.context);
  } else {
    logger.info(alertMsg, payload.context);
  }

  // If Slack webhook is configured, send the alert
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackWebhookUrl) {
    return; // No-op gracefully
  }

  try {
    const slackPayload = {
      text: `*${payload.severity} Alert: ${type}*\n${payload.message}`,
      attachments: payload.context
        ? [
            {
              color:
                payload.severity === "CRITICAL"
                  ? "#ff0000"
                  : payload.severity === "WARNING"
                    ? "#ffa500"
                    : "#36a64f",
              text:
                "```\n" + JSON.stringify(payload.context, null, 2) + "\n```",
            },
          ]
        : undefined,
    };

    await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
    });
  } catch (err) {
    logger.error("Failed to send Slack alert", { error: err });
  }
};
