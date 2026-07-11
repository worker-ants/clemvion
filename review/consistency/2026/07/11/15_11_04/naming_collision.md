# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 검토 요약 (선-확인)

target 커밋은 `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` 단일 파일을
`dto/responses/{execution-status-response,interact-ack-response,refresh-token-response}.dto.ts` 3개 파일로
분할하는 **순수 리팩터**다. 클래스명(`ExecutionStatusDto` / `InteractAckDto` / `RefreshTokenResponseDto` /
`CurrentNodeDto` / `NodeOutputContextDto` / `WaitingContextBaseDto`)은 모두 origin/main 에 이미 존재하던
식별자이며 diff 상에서 값·시그니처 변경 없이 그대로 이동했다(삭제+동일 내용 재생성 = git 상 non-rename diff 로
표기되지만 내용은 동일). 즉 **본 target 이 "새로 부여"하는 도메인 식별자(요구사항 ID·엔티티명·endpoint·이벤트명·ENV
키)는 하나도 없다** — 확인된 신규 항목은 오직 코드 파일 경로 3개뿐이다.

## 발견사항

- **[INFO]** 신규 파일 경로는 기존 컨벤션에 부합 — 충돌 아님, 오히려 기존 위반을 해소
  - target 신규 식별자(파일 경로):
    - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
    - `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.ts`
    - `codebase/backend/src/modules/external-interaction/dto/responses/refresh-token-response.dto.ts`
  - 기존 사용처: `spec/conventions/swagger.md` §5-1 "응답 DTO 위치" (라인 277-278) — SoT 로
    `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts` 패턴을 이미 명시하고 있고,
    이 패턴은 `executions/dto/responses/execution-response.dto.ts`, `workflows/.../workflow-response.dto.ts`,
    `auth/.../auth-response.dto.ts` 등 20개 이상의 다른 모듈에서 이미 동일하게 쓰이고 있다
    (`git -C <worktree> grep`로 확인, 각 이름 고유·중복 없음).
  - 상세: 개정 전 `external-interaction/dto/responses.dto.ts`(단수, 평평한 단일 파일)가 오히려 이 컨벤션의
    예외였다. target 은 그 예외를 제거해 module-local 명명이 repo-wide 컨벤션과 정렬되도록 한 것 — 새 식별자가
    다른 의미로 기존에 쓰이는 사례는 없다(각 파일명이 모듈 전역에서 유일).
  - target spec 본문(`spec/5-system/14-external-interaction-api.md` 라인 858-864, 코드 트리 블록)과
    `spec/conventions/interaction-type-registry.md` (라인 40, 옛 파일 경로 `.../dto/responses.dto.ts` 참조)가
    이번 diff 로 새 파일 경로를 반영하도록 동시 갱신되었음을 `git diff origin/main...HEAD -- spec/` 로 확인함 —
    옛 파일명에 대한 stale 참조가 spec/ 전역에 남아있지 않다.
  - 제안: 조치 불필요. 컨벤션 정합 방향의 변경이므로 그대로 유지.

- **[INFO]** DTO 클래스명 자체는 새 식별자가 아님 — 재확인 참고용
  - `InteractAckDto`(§5.1/§5.4 ack body), `RefreshTokenResponseDto`(§5.5), `ExecutionStatusDto`(§5.3) 는
    diff 이전부터 `spec/5-system/14-external-interaction-api.md` 라인 272/888/1121 및
    `spec/7-channel-web-chat/3-auth-session.md` 라인 104 에서 이미 참조되던 이름이며, `RefreshTokenResponseDto`
    는 `spec/1-data-model.md` §2.18.1 의 사용자 인증용 `RefreshToken` 엔티티와 이름이 유사하지만 이는
    target diff 가 새로 만든 충돌이 아니라 diff 이전부터 존재하던(그리고 코드베이스에서 각각 다른 스코프로 이미
    구분돼 쓰이고 있는) 기존 상태다. 본 검토(신규 식별자 충돌)의 범위 밖으로 판단해 등급 부여하지 않음.

## 요약

이번 target 변경은 spec 본문 요구사항이나 도메인 식별자(요구사항 ID·엔티티/DTO 명·API endpoint·이벤트명·ENV
키)를 전혀 신규 도입하지 않는 순수 코드 파일 분할 리팩터다. 유일하게 "새로" 생긴 것은 3개의 코드 파일 경로이며,
이는 `swagger.md` §5-1 에 이미 명시된 `dto/responses/*-response.dto.ts` repo-wide 컨벤션을 따른 것으로,
기존 20+ 모듈과 이름이 겹치지 않고 오히려 개정 전 EIA 모듈의 컨벤션 예외를 해소한다. spec 본문과 인접 규약
문서(`interaction-type-registry.md`)의 경로 참조도 diff 에 동반 갱신되어 stale reference 가 남지 않았다.
신규 식별자 충돌 관점에서 지적할 CRITICAL/WARNING 은 없다.

## 위험도

NONE
