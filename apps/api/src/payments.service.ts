import { Injectable, ServiceUnavailableException } from "@nestjs/common";

type PaystackResponse<T> = {
  status: boolean;
  message?: string;
  data?: T;
};

export type PaymentVerification = {
  reference: string;
  providerReference: string;
  status: string;
  amountMinor: number;
  currency: string;
};

export interface PaymentProvider {
  initialize(input: { reference: string; email: string; amountMinor: number; currency: string; callbackUrl: string }): Promise<{ authorizationUrl: string }>;
  verify(reference: string): Promise<PaymentVerification>;
}

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

@Injectable()
export class PaystackPaymentProvider implements PaymentProvider {
  private secret() {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new ServiceUnavailableException("Online wallet funding is not configured.");
    return secret;
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    try {
      const response = await fetch("https://api.paystack.co" + path, {
        ...init,
        headers: {
          Authorization: "Bearer " + this.secret(),
          "Content-Type": "application/json",
          ...(init?.headers || {})
        },
        signal: AbortSignal.timeout(10000)
      });
      const result = await response.json() as PaystackResponse<T>;
      if (!response.ok || !result.status || !result.data) throw new Error("Payment provider rejected the request.");
      return result.data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Payment provider is temporarily unavailable.");
    }
  }

  async initialize(input: { reference: string; email: string; amountMinor: number; currency: string; callbackUrl: string }) {
    const data = await this.call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        reference: input.reference,
        email: input.email,
        amount: input.amountMinor,
        currency: input.currency,
        callback_url: input.callbackUrl
      })
    });
    let checkoutHost = "";
    try { checkoutHost = new URL(data.authorization_url).hostname; } catch { checkoutHost = ""; }
    if (data.reference !== input.reference || checkoutHost !== "checkout.paystack.com") {
      throw new ServiceUnavailableException("Payment provider returned an invalid checkout response.");
    }
    return { authorizationUrl: data.authorization_url };
  }

  async verify(reference: string): Promise<PaymentVerification> {
    const data = await this.call<{
      id: number;
      reference: string;
      status: string;
      amount: number;
      currency: string;
    }>("/transaction/verify/" + encodeURIComponent(reference));
    return {
      reference: data.reference,
      providerReference: String(data.id),
      status: data.status,
      amountMinor: data.amount,
      currency: data.currency
    };
  }
}