# Consistency Check 통합 보고서 (--impl-done, 코드 품질 PR)

**BLOCK: NO** — Critical 0. WARNING 3건은 spec-side(PR #605) 또는 선존 — 본 코드 PR 비차단.

## 전체 위험도
**LOW** — Critical 없음. WARNING 3(규약/cross-spec), INFO 다수(대부분 spec drift·선존).

## Critical
없음.

## 경고 (WARNING) — 처리
| # | Checker | 위배 | 처리 |
|---|---------|------|------|
| 1 | Cross-Spec | `terminal-revoke-reconcile` 큐가 16-system-status-api §1 표 누락 | **fix — PR #605**(doc-sync 에 §1 등재 완료. 본 code-quality 워크트리 spec 은 #605 미반영이라 누락으로 보임). |
| 2 | Convention | `dto/responses.dto.ts` flat 경로 — 규약 `dto/responses/*-response.dto.ts` 미준수 | **선존**(본 diff 무관, DTO 파일 이동은 별도 refactor) → 후속. |
| 3 | Convention | controller `@ApiBadRequestResponse` description 의 `VALIDATION_FAILED`(정식 `VALIDATION_ERROR`) | **선존 drift**(#604 가 코드/스펙은 VALIDATION_ERROR 로 바꿨으나 이 Swagger 설명 문자열 미갱신. 본 diff 는 @ApiAcceptedResponse 만 변경) → 후속 1줄 수정. |

## 참고 (INFO) — 처리
- I1 (`.types.ts` 미생성 빌드오류 우려) — **오확인**, 파일 존재(`terminal-revoke-reconciler.types.ts` 생성됨)·build·e2e 191 통과.
- I2 (spec §8.3 "비보안 placeholder" vs ephemeral random) — **fix — PR #605**(§8.3 ephemeral 표현 갱신).
- I3~I6 Rationale: ephemeral·types 분리·delete 단언 전부 기존 Rationale 와 정합/강화. 조치 불요.
- I7~I14: JSDoc 누락·spec/16 §Rationale 헤더·§1 갭 callout stale(makeshop 정정)·plan 보류·naming 등 = 선존/spec-side 후속.

## Checker별
| Checker | 위험도 |
|---------|--------|
| Cross-Spec | LOW (큐 spec/16 — PR #605 해소) |
| Rationale | NONE |
| Convention | LOW (DTO 경로·Swagger 문자열 — 선존) |
| Plan/Naming | LOW (spec drift INFO) |

## 결론
**BLOCK: NO.** W1·I2 = PR #605(spec). W2·W3 = 선존(후속). 본 코드 PR 비차단 — push.
