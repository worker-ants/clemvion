# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 메모

1. `.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 Read 해 SSOT 로 적재.
2. 변경 파일 식별: 코드 변경 set 은 다음 3개 뿐이다 (그 외는 plan 문서·직전 consistency-check 산출물로 doc-sync 매트릭스와 무관).
   - `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`
   - `codebase/backend/src/modules/auth/webauthn/webauthn.service.spec.ts`
   - `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` (신규)
3. `git diff --stat` 로 직전 형제 커밋(#1374 `auth-configs`, #1375 `model-config`)과 대조 — 동일 클래스(동시 DELETE 중복 감사 수정)의 8개 선례 전부 frontend docs/dict 무변경으로 확인.

## trigger 매칭 검토

- **`auth-session-flow-change`** (`codebase/backend/src/modules/auth/**`, match=semantic, targets: `07-workspace-and-team/` 관련 페이지 + e2e) — 경로 구조상으로는 `webauthn.service.ts` 가 이 glob 하위에 들어가 표면적으로 걸린다. 그러나 semantic 판단으로는 **해당 없음**으로 판정한다:
  - 변경 내용은 `deleteCredential()` 의 `credentialRepo.delete()` 반환값(`affected`) 을 판정에 쓰도록 한 **동시성 race 교정**이다 (`형제 여덟` #1369~#1375 와 동일 클래스). 사용자에게 노출되는 정상 삭제 플로우(휴지통 아이콘 → 확인)는 변경되지 않았다.
  - `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.mdx:65` 에 이미 서술된 "삭제: 휴지통 아이콘 → 확인. 마지막 Passkey 를 삭제하면 WebAuthn 복구 코드도 함께 폐기돼요." 는 이번 변경 후에도 그대로 참이다. 이번 수정이 새로 만드는 사용자 가시 상태는 "동시에 같은 credential 을 두 번 삭제 시도하면 진 쪽이 404" 뿐인데, 이는 정상 단일-액션 플로우 밖의 엣지케이스라 가이드 서술 대상이 아니다.
  - 에러 코드 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 는 이번 diff 로 신규 발행되는 코드가 아니다 — `webauthn.service.ts` 안에 이미 4곳(다른 NotFoundException 분기)에서 동일 코드로 쓰이고 있었다(예: 404 line 404, 498, 504, 528 — 이번에 추가된 550-line 대의 다섯 번째 사용처는 기존 판정 로직을 재사용). `backend-labels.ts` 에 `WEBAUTHN_CREDENTIAL_NOT_FOUND` 매핑이 없는 것은 **이번 diff 이전부터의 기존 상태**이며 이번 변경이 새로 만든 갭이 아니다.
  - `plan/in-progress/webauthn-dup-delete.md` frontmatter 에 `spec_impact: none` 로 명시돼 있고, 선행 형제 커밋(#1374, #1375) 모두 동일 판단으로 docs 변경 없이 머지됐다 — 일관된 선례.
  - 결론: **CRITICAL/WARNING 아님** — 정보성 확인으로만 기록한다.

- 그 외 trigger (신규 노드, 노드 schema 변경, 신규 UI 문자열, 통합/제공자 변경, 신규 섹션 디렉토리, 표현식 언어 변경, 실행·디버깅 흐름 변경, 신규 warningCode/errorCode enum) — 변경 파일이 `.tsx`, `codebase/backend/src/nodes/**`, `codebase/packages/expression-engine/**`, `codebase/backend/src/nodes/core/error-codes.ts` 등 어느 glob 에도 해당하지 않아 매칭되지 않는다.

## 발견사항

- **[INFO]** `auth-session-flow-change` semantic trigger 의 경로 glob 이 표면적으로 겹치나 실질 갱신 불필요로 판정
  - 변경 파일: `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`
  - 매트릭스 항목: `auth-session-flow-change` — targets: "codebase/frontend/src/content/docs/07-workspace-and-team/ 의 관련 페이지 + e2e"
  - 누락된 동반 갱신: 없음 (판정 결과)
  - 상세: 이 커밋은 "동시 DELETE 두 건이 감사를 두 번 남기던" 결함 클래스의 9번째(마지막) 자리로, `affected === 0` 명시 비교를 추가한 내부 동시성 교정이다. 정상 단일-삭제 사용자 플로우·문서화된 UX·에러 코드 표면에 변화가 없다. e2e 보강(`webauthn-credential-delete-concurrency.e2e-spec.ts`)은 이미 같은 커밋에 포함되어 있어 매트릭스가 요구하는 "e2e" 요소도 충족된 상태다.
  - 제안: 조치 불필요. 향후 동일 시리즈의 10번째 이상 자리가 나올 경우도 같은 판정 기준(사용자 가시 플로우 변경 여부)으로 재확인 권장.

## 요약

매트릭스 20개 trigger 행 중 이번 변경 set(백엔드 `webauthn.service.ts`/`.spec.ts` + 신규 e2e 파일)에 구조적으로 겹치는 것은 `auth-session-flow-change` 1건뿐이며, semantic 판단 결과 실질 갱신 누락 없음(선례 8건과 동일 패턴, `spec_impact: none`, 기존 에러 코드 재사용, 문서화된 UX 변경 없음)으로 결론지었다. 그 외 노드/UI 문자열/통합/섹션/표현식/실행-디버깅/신규 코드 trigger 는 매칭 대상 파일이 없어 전부 해당 없음이다.

## 위험도

NONE
