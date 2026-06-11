# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

해당 없음. 변경 set 이 매트릭스의 어떤 trigger 에도 유저 가이드 동반 갱신 누락으로 귀결되지 않는다.

### 매트릭스 trigger 매칭 결과

변경 파일은 다음 5종이다 (plan/review 파일 제외):

1. `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx`
2. `codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx`
3. `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`
4. `codebase/frontend/src/lib/i18n/dict/en/knowledgeBases.ts`
5. `codebase/frontend/src/lib/i18n/dict/ko/knowledgeBases.ts`

매트릭스 18개 행에 대한 매칭 결과:

| 행 ID | trigger | 매칭 여부 | 판정 근거 |
|---|---|---|---|
| `new-node` | `codebase/backend/src/nodes/**` glob | 불일치 | 백엔드 노드 파일 없음 |
| `node-schema-change` | `codebase/backend/src/nodes/**` glob | 불일치 | 백엔드 노드 파일 없음 |
| `new-ui-string` | `codebase/frontend/src/**/*.tsx` semantic | **매칭** — 신규 i18n 키 사용 TSX → 아래 상세 참조 |
| `integration-provider-change` | semantic | 불일치 | 통합/제공자 변경 아님 |
| `new-userguide-section-dir` | `codebase/frontend/src/content/docs/*/` glob | 불일치 | docs 디렉토리 신규 생성 없음 |
| `backend-api-change` | controller/DTO glob, semantic | 불일치 | 신규 API 없음(기존 `POST /re-embed` 재사용) |
| `new-warning-code` | semantic | 불일치 | backend warningRules 변경 없음 |
| `new-error-code` | `codebase/backend/src/nodes/core/error-codes.ts` glob | 불일치 | 해당 파일 변경 없음 |
| `new-cross-cutting-enum` | semantic | 불일치 | cross-cutting enum 추가 없음 |
| `new-backend-ui-zod-value` | semantic | 불일치 | 백엔드 zod ui.label/hint 변경 없음 |
| `new-handler-output-field` | semantic | 불일치 | output.result.* 신규 키 없음 |
| `auth-session-flow-change` | `codebase/backend/src/modules/auth/**` semantic | 불일치 | 인증·권한 미들웨어 변경 없음 (RoleGate 는 기존 컴포넌트 재사용) |
| `auth-config-type-enum-change` | semantic | 불일치 | AuthConfig type enum 변경 없음 |
| `expression-language-change` | `codebase/packages/expression-engine/**` semantic | 불일치 | 표현식 엔진 변경 없음 |
| `run-debug-flow-change` | semantic | 불일치 | 실행·디버깅 흐름 변경 없음 |
| `env-runtime-change` | semantic | 불일치 | 환경 변수·런타임 변경 없음 |
| `spec-major-change` | `spec/2-*/**` 등 glob | 불일치 | spec 파일 변경 없음(본 PR 변경 set 에 미포함) |
| `userguide-gui-flow-section` | `codebase/frontend/src/content/docs/02-nodes/**.mdx` 등 semantic | 불일치 | docs MDX 변경 없음 |

### `new-ui-string` trigger 상세 검증

`UnsearchableBanner` TSX 컴포넌트(`unsearchable-banner.tsx`)가 신규 i18n 키 4종을 `useT()` 로 참조한다:

- `knowledgeBases.reembeddingInProgress` — 기존 키(선행 PR #508 에서 등록)
- `knowledgeBases.reembeddingRequired` — 기존 키(선행 PR #508 에서 등록)
- `knowledgeBases.reembedNow` — **신규**
- `knowledgeBases.unsearchableBannerIdleDesc` — **신규**
- `knowledgeBases.unsearchableBannerInProgressDesc` — **신규**

i18n parity 점검 결과:

| 키 | `dict/ko/knowledgeBases.ts` | `dict/en/knowledgeBases.ts` | 판정 |
|---|---|---|---|
| `reembedNow` | "지금 재임베딩" (line 123) | "Re-embed now" (line 126) | 양쪽 등록 완료 |
| `unsearchableBannerIdleDesc` | 등록 완료 (line 124-125) | 등록 완료 (line 127-129) | 양쪽 등록 완료 |
| `unsearchableBannerInProgressDesc` | 등록 완료 (line 126-128) | 등록 완료 (line 130-131) | 양쪽 등록 완료 |

i18n parity 가드 통과. 신규 키 3종 전부 `ko`/`en` 양쪽에 동일 PR 내에서 등록됐으며 하드코딩된 한국어 리터럴도 없다. CRITICAL 조건 해당 없음.

## 요약

매트릭스 18개 trigger 를 전수 검토한 결과 본 PR 은 frontend-only presentational 배너 추가이며 백엔드 노드·API·인증·표현식 엔진·docs 구조 변경이 전혀 없다. 유일하게 매칭된 `new-ui-string` trigger 에서는 신규 i18n 키 3종이 ko/en 양쪽에 동시 등록되어 parity 가드를 충족했다. 매트릭스 18개 trigger 중 1개 매칭, 누락 0건.

## 위험도

NONE
