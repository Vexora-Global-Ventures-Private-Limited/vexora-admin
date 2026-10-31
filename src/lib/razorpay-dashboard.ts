/**
 * Deep links into the Razorpay dashboard. The dashboard shows test or live
 * data depending on the mode toggle in its header — the admin may need to
 * switch to Test Mode for orders created with an `rzp_test_` key.
 *
 * Orders created while the backend mocked Razorpay (`order_mock_…`) were
 * never sent to Razorpay, so they have no dashboard page.
 */
const DASHBOARD = "https://dashboard.razorpay.com/app"

export const isMockRazorpayOrder = (orderId: string | null | undefined) => !!orderId && orderId.startsWith("order_mock_")

export function razorpayOrderUrl(orderId: string | null | undefined): string | null {
  if (!orderId || isMockRazorpayOrder(orderId) || !/^order_[A-Za-z0-9]+$/.test(orderId)) return null
  return `${DASHBOARD}/orders/${orderId}`
}

export function razorpayPaymentUrl(paymentId: string | null | undefined): string | null {
  if (!paymentId || paymentId.startsWith("pay_demo_") || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) return null
  return `${DASHBOARD}/payments/${paymentId}`
}
