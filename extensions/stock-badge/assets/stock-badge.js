// Updates the low-stock text when the shopper picks another variant (colour, size...).

(function () {
  function selectedVariantId() {
    const input = document.querySelector('form[action*="/cart/add"] [name="id"]');
    if (input && input.value) return input.value;
    return new URL(window.location.href).searchParams.get("variant");
  }

  function update() {
    const variantId = selectedVariantId();

    // Look the elements up every time: some themes replace the product
    // section's HTML when the variant changes.

    document.querySelectorAll("[data-stockwatch]").forEach(function (message) {
      const dataElement = message.querySelector("[data-stockwatch-data]");
      const textElement = message.querySelector("[data-stockwatch-text]");
      if (!dataElement || !textElement || !variantId) return;

      const data = JSON.parse(dataElement.textContent);
      const count = data.variants[variantId];

      if (typeof count === "number" && count >= 1) {
        const template = count === 1 ? data.singular : data.plural;
        // textContent, never innerHTML, so the message can't inject HTML.

        textElement.textContent = template.split("{count}").join(String(count));
        message.style.display = "";
      } else {
        message.style.display = "none";
      }
    });
  }

  // Themes update the selected variant at different speeds (some instantly,
  // some after fetching new HTML), so check right away and again shortly after.

  document.addEventListener("change", function () {
    setTimeout(update, 50);
    setTimeout(update, 500);
  });

  update();
})();
