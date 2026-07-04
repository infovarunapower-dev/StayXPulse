import { useCallback } from 'react';

/**
 * Loads Razorpay checkout SDK dynamically and returns an open() function.
 * Usage:
 *   const openRazorpay = useRazorpay();
 *   await openRazorpay({ orderId, amount, ... });
 */
const useRazorpay = () => {
  const loadScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const script  = document.createElement('script');
      script.src    = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const openRazorpay = useCallback(async ({
    orderId, amount, currency = 'INR', keyId,
    name, description, email, phone,
    onSuccess, onFailure,
  }) => {
    const loaded = await loadScript();
    if (!loaded) {
      alert('Failed to load payment gateway. Please check your internet connection.');
      return;
    }

    const options = {
      key:         keyId,
      amount,
      currency,
      name:        'HotelIQ',
      description,
      order_id:    orderId,
      prefill:     { email, contact: phone },
      theme:       { color: '#0D9488' },
      modal: {
        ondismiss: () => onFailure?.('Payment cancelled by user.'),
      },
      handler: (response) => onSuccess?.(response),
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', (resp) => onFailure?.(resp.error?.description || 'Payment failed.'));
    rzp.open();
  }, []);

  return openRazorpay;
};

export default useRazorpay;
