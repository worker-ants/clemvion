# @workflow/node-summary

노드 config 에 대한 경고(`warningRules`) 평가와 캔버스/리뷰용 요약 템플릿(`summaryTemplate`) 렌더링의 SSOT.

- 프론트엔드: 캔버스 노드 카드의 ⚠ 배지·요약 라벨 렌더링
- 백엔드: `NodeHandler.validate()` 와 AI assistant 의 `WORKFLOW_REVIEW_REQUIRED` 검토

같은 규칙을 두 layer 가 공유해야 spec 변경 시 자동으로 정렬된다.

## 빌드

```bash
npm run build
npm run watch
npm test
```

`codebase/backend` / `codebase/frontend` 가 workspace dep 로 import 하므로 두 앱 실행 전 build 가 선행되어야 한다.

## 사용

백엔드 (handler.validate):

```ts
import { evaluateWarnings } from '@workflow/node-summary';

const errors = evaluateWarnings(config, this.metadata.warningRules)
  .filter((w) => w.severity === 'blocking')
  .map((w) => w.message);
```

프론트엔드 (canvas summary):

```ts
import {
  evaluateWarnings,
  renderSummaryTemplate,
} from '@workflow/node-summary';

const warnings = evaluateWarnings(config, def.metadata.warningRules);
const blocking = warnings.find((w) => w.severity === 'blocking');
if (blocking) return { text: `⚠ ${blocking.message}`, isWarning: true };

return {
  text: renderSummaryTemplate(def.metadata.summaryTemplate, config),
  isWarning: false,
};
```

## 주요 export

| Symbol | 설명 |
|--------|------|
| `evaluateWarnings(config, rules)` | warningRules 평가 → `{ severity, message }[]` |
| `renderSummaryTemplate(template, config)` | summaryTemplate 의 `${path}` placeholder 치환 |
| `WarningRule` / `WarningSeverity` | 규칙·심각도 타입 |

## boundary

- 본 패키지는 `@workflow/expression-engine` 만 (필요한 경우) 참조하며 다른 `packages/*` 를 참조하지 않는다.
- DOM / Node API 비의존 — 양쪽 런타임에서 동일하게 동작.
