<script>
  export default {
    name: 'DetailItem',
    props: {
      label: {
        type: String,
        required: true,
      },
      value: {
        type: [String, Number, Boolean, Object],
        required: true,
      },
    },
  };
</script>

<template>
  <div class="pb-2">
    <div class="my-title-xs-gray pb-1">{{ label }}</div>
    <div class="my-content-sm-black pb-1">{{ value }}</div>
  </div>
</template>

<style scoped>
  /* Add any component-specific styles here if needed */
  .lead {
    word-wrap: break-word; /* Ensure long values wrap */
  }

  .my-resizer-middle {
    background-color: white;
    position: relative;
    border-top: 1px solid var(--my-color-gray-200); /* 上邊框分隔線 */
    border-bottom: 1px solid var(--my-color-gray-200); /* 下邊框分隔線 */
  }
</style>
