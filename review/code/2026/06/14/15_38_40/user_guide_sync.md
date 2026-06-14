# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [INFO] 인증 설정 사용 내역 API 응답 shape 확장 — 대응 user-guide MDX 미존재 (pre-existing)

- 변경 파일: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`
- 매트릭스 항목: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 누락된 동반 갱신: 해당 없음 (pre-existing absence)
- 상세: `GET /api/auth-configs/:id/usage` 응답에 `periodCounts { last24h, last7d, last30d }`, `recentCalls[].sourceIp`, `recentCalls[].responseCode` 가 신규 추가됐다. 이 변경은 사용자에게 노출되는 새 UI 기능이지만, `codebase/frontend/src/content/docs/06-integrations-and-config/` 에 인증 설정(auth-config) 전용 user-guide MDX 페이지가 PR 전부터 존재하지 않는다(`authentication.mdx` 등 해당 없음). 기존 stale 페이지가 없으므로 "누락" 이 아닌 "페이지 없음" 상태다.
- 제안: 향후 인증 설정 사용 내역 관련 user-guide 페이지(`06-integrations-and-config/authentication.{mdx,en.mdx}`) 신설 시 새 API shape(`periodCounts`, `sourceIp`, `responseCode`) 와 UI 동작(소스 IP `—` 폴백, responseCode status enum 폴백, 롤링 윈도 차트)을 함께 문서화할 것을 권장한다. 이번 PR 의 blocking 사항은 아니다.

---

## 매칭 결과 요약

매트릭스 총 19개 행 중 이번 변경에 매칭되는 trigger 는 아래와 같다.

| trigger id | 매칭 근거 | 동반 갱신 상태 |
|---|---|---|
| `new-ui-string` | `authentication/page.tsx` 신규 TSX i18n key 7종 (`sourceIp`, `responseCode`, `periodCounts`, `callCount`, `period24h`, `period7d`, `period30d`) | **충족** — `dict/en/authentication.ts` + `dict/ko/authentication.ts` 양쪽 동일 7개 키 등록 확인 (파일 12, 13). ko/en parity 정상. |
| `backend-api-change` | `auth-configs/dto/responses/auth-config-response.dto.ts` (`dto/**` glob 매칭) | **부분 충족** — DTO 내 Swagger jsdoc 포함. 관련 user-guide 페이지 부재 (pre-existing, INFO 수준). |

나머지 17개 trigger (`new-node`, `node-schema-change`, `integration-provider-change`, `new-userguide-section-dir`, `auth-session-flow-change`, `new-warning-code`, `new-error-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-config-type-enum-change`, `expression-language-change`, `run-debug-flow-change`, `env-runtime-change`, `spec-major-change`, `userguide-gui-flow-section`, `spec-defect-found`) 는 이번 변경 파일 집합과 매칭되지 않는다.

## 요약

매트릭스 19개 trigger 중 2개가 이번 변경에 매칭되며, 누락 건수는 0건이다. `new-ui-string` trigger 는 `page.tsx` 신규 7개 i18n key 에 대해 `dict/ko/authentication.ts` 와 `dict/en/authentication.ts` 양쪽에 동일 키가 등록돼 i18n parity 가 완전히 충족됐다. `backend-api-change` trigger 는 DTO Swagger jsdoc 이 포함됐고 관련 user-guide MDX 페이지는 PR 이전부터 존재하지 않으므로 stale 문서 누락이 아니다 (INFO 관찰만).

## 위험도

NONE
