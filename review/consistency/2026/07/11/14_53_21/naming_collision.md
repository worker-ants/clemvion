# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 검토 요약

본 diff(`origin/main...HEAD`)는 `codebase/backend/src/modules/external-interaction/dto/responses.dto.ts` 단일 파일을
`dto/responses/{execution-status-response,interact-ack-response,refresh-token-response}.dto.ts` 3개로 분리하는
**순수 리팩터(파일 재배치 + import 경로 갱신)**다. 클래스명(`ExecutionStatusDto`, `CurrentNodeDto`,
`NodeOutputContextDto`, `WaitingContextBaseDto`, `ButtonsContextDto`, `InteractAckDto`, `RefreshTokenResponseDto`)은
전혀 변경되지 않았고, 신규 요구사항 ID·API endpoint·이벤트명·환경변수도 도입되지 않았다. 따라서 "새 식별자가 기존에
다른 의미로 쓰이는" 전형적 CRITICAL 충돌은 발견되지 않았다. 다만 파일 경로 재배치의 결과로 **기존 문서의 stale 참조**
2건을 발견했다 (아래).

## 검증한 항목 (충돌 없음 확인)

- **클래스명 전역 유일성**: `git grep -n "^export class <name>"` 로 7개 클래스 전부 전역 단일 선언 확인. 특히
  `ExecutionStatusDto`(EIA)와 이름이 유사한 `executions` 모듈의 `execution-response.dto.ts`는 실제로는
  `ExecutionDto`를 export하며 이름 충돌 없음.
- **파일 경로 컨벤션 정합**: 신규 경로 `dto/responses/*-response.dto.ts`는 [swagger.md §5-1](spec/conventions/swagger.md#5-1-응답-dto-위치) "`codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`" 규칙과 정확히 일치하며, 다른 25개 모듈(`folders`, `triggers`, `workflows`, `executions` 등)의 기존 관행과도 겹치는 파일명 없이 부합한다. 오히려 이번 분리로 `external-interaction`이 종전 flat-file 편차(`plan/in-progress/eia-context-schema-followups.md:16`가 지적하던 항목)를 해소했다.
- **API endpoint / 요구사항 ID / 환경변수 / 이벤트명**: 이번 diff에 신규 도입 없음 (컨트롤러 라우트·서비스 시그니처 불변, import 경로만 변경).

## 발견사항

- **[WARNING]** target spec 자체의 "구현 파일 구조" 다이어그램이 옛 flat 파일명을 그대로 진실로 서술
  - target 신규 식별자: `dto/responses/execution-status-response.dto.ts` / `interact-ack-response.dto.ts` / `refresh-token-response.dto.ts` (코드에 이미 존재, HEAD 기준 확정)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md` §10 "구현 파일 구조" 코드블록(라인 861 부근)에 여전히
    ```
    dto/
      interact.dto.ts
      cancel.dto.ts
      responses.dto.ts
      ...
    ```
    로 단일 파일 `responses.dto.ts`가 SoT처럼 나열되어 있다.
  - 상세: 이 spec 섹션은 "제품의 단일 진실"로 문서 맵에 명시된 구조도인데, 실제 HEAD 코드는 이미 3파일로 분리됐다. 신규 파일 경로(신규 식별자)가 도입됐음에도 target spec 본문(파일 구조 다이어그램)이 갱신되지 않아, spec 을 SoT로 신뢰하는 후속 작업자가 `dto/responses.dto.ts`를 찾거나 그 경로로 재생성해 다시 flat-file 편차를 재도입할 위험이 있다. 엄밀한 "동일 식별자의 다른 의미 충돌"은 아니지만, 신규 식별자 도입이 기존 spec 서술과 어긋나는 §6 파일 경로 관점의 실질적 drift다.
  - 제안: §10 파일 구조 블록을 3-파일 구조로 갱신 (`dto/responses/execution-status-response.dto.ts`, `dto/responses/interact-ack-response.dto.ts`, `dto/responses/refresh-token-response.dto.ts`).

- **[WARNING]** `interaction-type-registry.md`의 SoT 참조가 옛 파일 경로를 가리킴
  - target 신규 식별자: `external-interaction/dto/responses/execution-status-response.dto.ts` (4→3 interactionType 매핑의 실질 책임 위치 — `interactionType: 'form' | 'buttons' | 'ai_conversation'` enum 선언이 이 파일에 있음, 코드 확인 완료)
  - 기존 사용처: `spec/conventions/interaction-type-registry.md:40` — "이 4→3 통합은 **`chat-channel.dispatcher` 및 EIA 응답 DTO(`external-interaction/dto/responses.dto.ts`) 계층의 책임**이다" 로 옛 flat 경로를 인용.
  - 상세: 리팩터 이전엔 정확했던 경로 참조가, 이번 분리로 실제 파일이 없어졌다. 그대로 두면 후속 독자가 `responses.dto.ts`를 찾지 못해 SoT 추적이 끊긴다.
  - 제안: 참조를 `external-interaction/dto/responses/execution-status-response.dto.ts`로 갱신.

- **[INFO]** `plan/in-progress/eia-context-schema-followups.md:16`의 미체크 TODO가 본 diff로 이미 완료된 것으로 보임
  - 상세: 해당 항목은 "`external-interaction` 모듈 응답 DTO 위치 정규화 — flat `dto/responses.dto.ts`를 `dto/responses/*-response.dto.ts` 서브디렉토리로 이관"을 그대로 기술하며 `[ ]` 미체크 상태다. 본 diff가 정확히 이 작업을 수행했다. (신규 식별자 충돌 범주는 아니나, plan lifecycle 정합성 관점에서 인접 발견이라 병기.)
  - 제안: 이 항목의 실제 완료 여부를 개발자/기획자가 확인 후 체크박스 갱신.

- **[INFO]** `ExecutionStatusDto`(EIA, `external-interaction` 모듈) ↔ `ExecutionDto`(`executions` 모듈 `execution-response.dto.ts`) 이름 근접
  - 상세: 실제 클래스명은 다르고(`ExecutionStatusDto` vs `ExecutionDto`) 모듈도 분리되어 실질 충돌은 없으나, "Execution" 접두 + "-response.dto.ts" 파일명 패턴이 겹쳐 grep/IDE 검색 시 혼동 가능성이 있다. 기존에도 존재하던 이름 패턴이라 이번 diff가 새로 만든 문제는 아니다.
  - 제안: 별도 조치 불요 (참고용).

## 요약

이번 diff는 DTO 파일을 3개로 분리하는 순수 리팩터로, 클래스명·API endpoint·요구사항 ID·환경변수·이벤트명 등 실질적 신규 식별자를 새로 도입하지 않았고 전역 이름 충돌도 없다. 새 파일 경로는 오히려 프로젝트의 `dto/responses/*-response.dto.ts` 컨벤션에 정합해 기존 편차를 해소했다. 다만 파일 분리의 여파로 target spec 자신의 §10 파일 구조 다이어그램과 `spec/conventions/interaction-type-registry.md`의 SoT 참조가 옛 flat 경로(`dto/responses.dto.ts`)를 계속 가리키는 stale 상태가 됐다 — 엄밀한 "다른 의미의 동일 식별자 충돌"은 아니지만 문서-코드 drift로서 조치가 필요하다.

## 위험도

LOW
