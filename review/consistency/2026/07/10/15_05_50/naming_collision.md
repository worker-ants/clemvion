# 신규 식별자 충돌 검토 결과

대상: `plan/in-progress/catalog-residual-codes.md` (spec draft: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md` 변경안)

## 발견사항

- **[CRITICAL]** 신규 `NOT_A_MEMBER` 행의 대조 참조가 기존 "동일 의미·별개 wire 코드(통합 금지)" 식별자 쌍을 혼동 + 존재하지 않는 섹션을 인용
  - target 신규 식별자: `NOT_A_MEMBER` (변경 2a, `spec/5-system/3-error-handling.md §1.2` 신규 행)
  - 기존 사용처: `spec/data-flow/12-workspace.md §1.2`(초대 발급, lowercase `already_a_member`, `workspace-invitations.service.ts:110`) vs `§1.9`(멤버 직접 추가, UPPER_SNAKE `ALREADY_A_MEMBER`, `workspaces.service.ts:254`) — 두 코드는 `spec/conventions/error-codes.md:67`·`spec/data-flow/12-workspace.md:74,182`에서 "동일 의미·별개 wire 코드다(서로 다른 모듈·케이스 컨벤션 — 의도적 분리, **통합 금지**)"로 명시적으로 분리돼 있음. 초대 **수락**(`§1.3 초대 수락 (이미 가입한 사용자)`, `data-flow/12-workspace.md:77-98`)은 이미 멤버인 경우 `INSERT ... — 이미 멤버면 skip`(line 95)으로 **에러 없이 조용히 skip**한다 — 이 흐름은 어떤 "이미 멤버" 코드도 발행하지 않는다.
  - 상세: target 이 추가하는 행 원문(line 71): `"초대 수락 `ALREADY_A_MEMBER`(§1.9, 409)와 반대 의미"`. 이 한 구절에 세 가지 오류가 겹쳐 있다.
    1. **플로우 오귀속**: "이미 멤버" 409 를 실제로 발행하는 것은 초대 **발급**(§1.2, owner/admin 이 이미 멤버인 이메일을 초대할 때, `data-flow/12-workspace.md:60`)이지 "초대 수락"이 아니다. 초대 수락은 위에서 확인한 대로 무에러 skip.
    2. **식별자 case 혼동**: 초대 발급이 실제로 던지는 코드는 lowercase `already_a_member`(`workspace-invitations.service.ts`)이지, target 이 인용한 UPPER_SNAKE `ALREADY_A_MEMBER`(`workspaces.service.ts`, 워크스페이스 **직접 추가** 전용)가 아니다. 이 둘은 프로젝트가 이미 "통합 금지"로 못박은 별개 코드다.
    3. **존재하지 않는 섹션 참조**: "§1.9"는 target 이 편집 중인 `3-error-handling.md` 안에는 없는 섹션(해당 파일은 §1.8 까지만 존재, 본 리뷰 시점 실측)이다. `data-flow/12-workspace.md` 쪽 §1.9 를 가리킨 것이라면 그 섹션은 "**멤버 직접 추가** (기가입 사용자)"이지 "초대 수락"이 아니므로 인용된 플로우명과도 모순된다.
  - target 문서 **내부 모순**: 같은 target 의 Rationale bullet(line 88)과 "범위 밖" 섹션(line 102)은 각각 "workspace 직접-추가 경로 코드(`ALREADY_A_MEMBER` 등)는 ... 본 완결성 pass 범위 아님" / "등재 — deferred 목록 밖, 별도"라고 명시한다. 즉 `ALREADY_A_MEMBER`는 이번 pass 에서 **카탈로그에 등재되지 않는 코드**로 선언해 놓고, 바로 위 §1.2 신규 행(line 71)에서는 이미 카탈로그에 있는 것처럼 섹션 번호까지 붙여 참조하는 자기모순이 발생한다.
  - 제안: line 71 의 괄호 구절을 다음 중 하나로 정정.
    - (a) 완전 제거 — "범위 밖" 원칙과 정합하도록 `ALREADY_A_MEMBER`/`already_a_member` 언급 자체를 이번 pass 에서 빼고, `NOT_A_MEMBER` 설명은 전환 실패 사실관계만 남긴다.
    - (b) 정확히 고쳐 쓰기 — "초대 발급 시 이미 멤버 (`already_a_member`, lowercase, §1.2 초대 흐름, 409)"로 case·플로우명을 모두 정정하되, 이 lowercase 코드는 아직 `3-error-handling.md` 카탈로그에 미등재이므로 앵커 대신 `data-flow/12-workspace.md §1.2` 로 링크(현재 리뷰에서 실제 참조 가능한 유일한 SoT).
    - 어느 쪽이든 "범위 밖" 선언과 실제 인용 내용이 어긋나지 않는지 재확인 필요.

## 요약

target 이 새로 카탈로그화하는 `NOT_A_MEMBER`·`INVALID_PASSWORD`·`PASSWORD_REQUIRED` 세 코드 자체는 코드베이스 실사용(`auth.service.ts`·`workspaces.service.ts`·`users.service.ts`)과 정확히 일치하고, `INVALID_PASSWORD`↔`login_history.failure_reason` 동명값·`PASSWORD_INVALID`/`REAUTH_REQUIRED` 와의 4중 근접명명 disambiguation 도 target 스스로 잘 처리했다. 다만 §1.2 신규 `NOT_A_MEMBER` 행에 끼워 넣은 대조 설명 "초대 수락 `ALREADY_A_MEMBER`(§1.9, 409)와 반대 의미"는 (1) 실제로 그 코드를 발행하는 플로우("초대 발급", 이미 멤버인 초대 시도)를 다른 플로우("초대 수락", 실제로는 무에러 skip)로 오귀속하고, (2) 발행되는 실제 식별자(lowercase `already_a_member`)와 다른 식별자(UPPER_SNAKE `ALREADY_A_MEMBER`, 직접-추가 전용)를 혼동하며, (3) 편집 대상 파일에 존재하지 않는 섹션 번호를 인용하고, (4) target 자신의 "범위 밖 — 이번 pass 미등재" 선언과 모순된다. 이는 프로젝트가 이미 "동일 의미·별개 wire 코드, 통합 금지"로 명시한 두 기존 식별자를 뒤섞어 새 카탈로그 행에 노출시키는 것이므로 병합 전 정정이 필요하다.

## 위험도

MEDIUM
