# Rationale 연속성 검토 결과

대상: `plan/in-progress/workspace-membership-codes.md` (spec_impact: `spec/5-system/3-error-handling.md`)

## 발견사항

검토 관점 1~4 (기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / 암묵적 가정 충돌) 에 해당하는 CRITICAL·WARNING 항목 없음. 상세 대조 결과는 아래 근거 참고.

- **[INFO]** #893 deferred 포인터의 사후 추적성 보강 제안
  - target 위치: target 문서 "배경" 절 (L33-36) 및 "Rationale 신규 bullet" (L78-81)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` `## Rationale` — "**§1 카탈로그 완결성 종결 — #882/#887 deferred 잔여 등재**" bullet 의 "**범위 한정**" 문장 (workspace 직접-추가 경로 코드는 #882/#887 deferred 목록 밖이라 "별도 완결성 pass" 로 명시 유보)
  - 상세: target 은 이 유보를 정확히 인지하고 그 "별도 완결성 pass" 를 지금 수행하는 것으로 스스로 설명한다. 다만 현재 spec 의 해당 과거 bullet 텍스트는 "본 pass 범위 아님(별도 완결성 pass)" 로만 적혀 있어, 이 신규 §1.9 bullet 이 실제로 그 pass 를 완결했다는 역참조가 과거 bullet 쪽에는 남지 않는다 (Rationale 은 append-only 로 과거 bullet 을 사후 수정하지 않는 것이 이 저장소의 기존 관행 — 예: #882/#887 bullet 도 사후에 편집되지 않았다). 이는 위반이 아니라 저장소 관행과 일치하는 선택이지만, 향후 독자가 과거 bullet 만 읽고 "아직 미완결" 로 오인하지 않도록 원한다면 옵션이다.
  - 제안: 필수 아님. 원한다면 §1 카탈로그 완결성 bullet 끝에 "→ §1.9 로 완결(2026-07-10)" 같은 짧은 후행 포인터를 추가할 수 있으나, 기존 저장소 관행(append-only, 과거 bullet 비수정)을 따르는 현재 형태도 문제 없음.

## 대조 근거 (교차검증 상세)

1. **"별도 완결성 pass" 출처 검증** — `git log --oneline -- spec/5-system/3-error-handling.md` 확인 결과 PR #893 (커밋 `7f395638f`)가 정확히 이 "범위 한정… 별도 완결성 pass" 문장을 도입한 커밋이다. target 의 "#893 Rationale 이 '별도 완결성 pass' 로 남긴" 서술은 사실과 정확히 일치 — 날조·왜곡 없음.

2. **본문 SoT 선행 여부** — target 이 인용하는 `data-flow/12-workspace.md §1.9` (`CANNOT_ASSIGN_OWNER`/`ALREADY_A_MEMBER`/`WORKSPACE_TYPE_MISMATCH`/`USER_NOT_FOUND` 정의) 는 `git log -S "1.9 멤버 직접 추가"` 로 확인 시 2026-06-10 (#516) 전수 감사 때부터 이미 존재하던 body 문서다. #882 Rationale 이 세운 "spec 문서화 → 등재" 순서 원칙(§1 카탈로그 완결성 bullet)에 target 이 정확히 부합 — 본문 SoT 가 먼저 있고 지금 카탈로그 등재만 하는 것으로, 새 정의를 카탈로그에서 임의로 만들어내는 게 아니다.

3. **패턴 재사용의 정당성** — "도메인 spec 참조" 서브섹션 패턴(정의 SoT=도메인 spec, §1 은 공용 카탈로그 가시성 등재)은 #882 Rationale (`§1 카탈로그 완결성 — 2FA/WebAuthn(§1.2.1)·KB/Graph RAG(§1.8) 도메인 등재` bullet)이 이미 확립한 원칙이며, target 은 이를 "새 원칙 도입"이 아니라 그대로 재사용해 §1.9 를 신설한다. §1.5~§1.8 모두 status 열 혼재(400/401/403/409/410/429 등)를 쓰므로, §1.2(401/403/423 전용)에 409(`ALREADY_A_MEMBER`)를 섞지 않고 별도 서브섹션으로 분리한 target 의 배치 결정도 기존 선례와 정합한다.

4. **UPPER/lowercase 동명 코드 구분 원칙 준수** — `spec/conventions/error-codes.md §3` (historical-artifact 레지스트리) 는 이미 `already_a_member`/`workspace_type_mismatch`(lowercase, 초대 흐름)와 §1.9 의 UPPER_SNAKE 동명 코드가 "동일 의미·별개 wire 코드"이며 "의도적 분리, 통합 금지"라고 명시해 두었다(기존 문서, target 이전부터 존재). target 의 §1.9 초안 note 문구("동일 의미·별개 wire 코드다 …의도적 분리·통합 금지")는 이 기존 규정을 정확히 반복 — 오히려 이 원칙을 흐리지 않고 강화한다.

5. **generic 코드 제외 근거** — target 이 `USER_NOT_FOUND`(404) 를 도메인 카탈로그에서 제외하는 근거("auth·users 전역 공용")는 코드 검증(`auth.service.ts`/`webauthn.service.ts`/`totp.service.ts`/`users.service.ts`/`users.controller.ts`/`notifications.service.ts`/`workspaces.service.ts` 전부 동일 코드 발행) 결과와 일치한다.

6. **코드 ground truth 정합성** — `workspaces.service.ts` 의 `addMemberByEmail` 실측(`CANNOT_ASSIGN_OWNER` L238, `ALREADY_A_MEMBER` L254, `WORKSPACE_TYPE_MISMATCH` L763 부근) 확인 결과 target 표의 status·trigger 서술과 일치.

7. **신규 §1.9 앵커 충돌 없음** — `error-handling.md` 본문에 기존 §1.9 는 없으며(현재 최대는 §1.8), 다른 spec 문서 어디에도 `3-error-handling.md#1-9`(또는 `#19-...`) 를 향한 기존 forward reference 가 없어 신설로 인한 링크 충돌·의미 재정의 위험 없음.

## 요약

target 은 스스로 인용한 과거 Rationale (#893, `spec/5-system/3-error-handling.md`) 이 명시적으로 "별도 완결성 pass" 로 유보해 둔 항목을 실제로 실행하는 후속 pass이며, 그 유보 문구의 출처(커밋 #893)·유보 대상 코드(workspace 직접-추가 3코드)·재사용하는 설계 패턴(§1.5~§1.8 도메인 참조 서브섹션)·인용하는 기존 규정(error-codes.md §3 historical-artifact 의 UPPER/lowercase 분리 원칙) 모두 실제 spec 상태와 정확히 일치한다. 기각된 대안을 재도입하거나 합의 원칙을 우회하는 정황은 발견되지 않았고, 오히려 기존에 명시적으로 예고된 결정을 그대로 이행하는 모범적인 continuity 사례다. Rationale 신규 bullet 초안도 근거·범위·배치 이유를 명시해 "무근거 번복" 에 해당하지 않는다.

## 위험도

NONE
