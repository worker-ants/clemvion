STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 trigger 행) + `PROJECT.md` §127-197 (§변경 유형 → 갱신 위치 매핑 + §자주 누락되는 항목) 을 SoT 로 적재했다.

## 변경 파일 목록 (36건, prompt 상)

내부 리팩터 — masking marker 상수(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)와 깊이 상한(`MAX_MASK_DEPTH`)을 신규 공유 패키지 `@workflow/masked-markers` 로 추출해, backend `sanitize-error-message.ts` 와 frontend `lib/utils/masked-markers.ts` 가 동일 SoT 를 재export 하도록 바꾼 것이 핵심이다.

| 분류 | 파일 |
| --- | --- |
| CI/빌드 배선 (내부 패키지 등록) | `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, `codebase/backend/Dockerfile`, `codebase/frontend/Dockerfile`, `codebase/frontend/Dockerfile.playwright-e2e`, `codebase/backend/package.json`, `codebase/frontend/package.json`, `pnpm-lock.yaml` |
| 신규 공유 패키지 소스 | `codebase/packages/masked-markers/{README.md,eslint.config.mjs,package.json,tsconfig.json,src/index.ts,src/__tests__/index.spec.ts}` |
| 소비처 리팩터 (재export 로 전환, 값 불변) | `codebase/backend/src/shared/utils/sanitize-error-message.ts`, `codebase/frontend/src/lib/utils/masked-markers.ts` |
| 신규 repo-guard (미러 재발 방지) | `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`, `.../masked-marker-mirror.test.ts` |
| plan 문서 | `plan/in-progress/masked-marker-shared-package.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` |
| 기존 consistency 리뷰 산출물 (본 PR 과 무관, 이전 세션 산출) | `review/consistency/2026/08/21/{10_45_52,10_58_25}/*` |

## trigger 매칭 검토

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 변경 파일 중 이 glob 에 해당하는 것 없음 (`sanitize-error-message.ts` 는 `src/shared/utils/`, `error-codes.ts` 자체는 미변경). 불일치.
- **신규 UI 문자열 (TSX)** — 변경 파일 중 `.tsx` 없음. `masked-markers.ts`/`masked-marker-mirror*.ts` 는 전부 `.ts` (유틸·테스트)이고 그 안의 한국어는 JSDoc 주석 — 런타임 UI 문자열이 아니다. 불일치.
- **통합/제공자 변경** — 해당 없음.
- **신규 섹션 디렉토리** (`content/docs/<NN>-<name>/`) — 미변경. 불일치.
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — `sanitize-error-message.ts` 는 egress 에러 메시지 마스킹 공용 유틸이지 auth 모듈이 아니다. 불일치.
- **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 신규 패키지는 `codebase/packages/masked-markers/**` 이고 expression-engine 은 미변경. 불일치.
- **실행·디버깅 흐름 변경** — 미변경. 불일치.
- **신규 warningCode/errorCode 발행** — `error-codes.ts`(`ErrorCode` enum) 미변경. 마커 값 자체(`VALUE_MASK_MARKER='***'` 등)도 리팩터 전후로 **동일**하다 (diff 확인: 이관 전후 리터럴 값 불변). 불일치.
- **AuthConfig / cross-cutting enum / handler output field / BullMQ 큐 / spec 대규모 변경** — 전부 무관.

이 PR 은 값을 옮겼을 뿐 **사용자 가시 문자열·동작을 하나도 바꾸지 않는다** (README/index.ts 에도 "마커를 추가하면 자동 동작" 이라고 명시 — 즉 이번 PR 자체는 마커 추가가 아니라 SoT 이관). 신규 `masked-marker-mirror` repo-guard 는 향후 미러 재발을 막는 정적 가드일 뿐 사용자 가이드 대상이 아니다.

## 요약
매트릭스 20개 trigger 행 전부를 36개 변경 파일에 대조했고, 매칭되는 trigger 가 없다 (신규 노드·스키마·UI 문자열·통합·섹션 디렉토리·인증 흐름·표현식 언어·실행/디버깅·warning/error code 전부 불일치). 누락 0건.

### 위험도
NONE
