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
      /** 為 true 時 value 以 HTML 渲染（如排放量 CO<sub>2</sub>e） */
      isHtml: {
        type: Boolean,
        default: false,
      },
    },
  };
</script>

<template>
  <div class="pb-2">
    <div class="my-title-xs-gray pb-1">{{ label }}</div>
    <div
      v-if="isHtml"
      class="my-content-sm-black pb-1 detail-item-value-html"
      v-html="value"
    ></div>
    <div v-else class="my-content-sm-black pb-1">{{ value }}</div>
  </div>
</template>

<style scoped>
  .detail-item-value-html :deep(.carbon-emission-unit sub) {
    font-size: 0.72em;
    line-height: 0;
  }

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
