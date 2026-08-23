# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** `swagger.md §3` 보안·정책 캐비엇이 "예외"에서 "지시(mandate)"로 재정의됐다고 선언한 새 문단이, 바로 이어지는(수정하지 않은) 옛 문단·헤딩과 프레이밍이 어긋난 채 병존한다.
  - 위치: `spec/conventions/swagger.md:272` (신설 — `> 2026-08-23 "예외"→"적극 지시" 재정의):`), `spec/conventions/swagger.md:286` (미변경 컨텍스트 — `> 근거: [§Rationale — §3 보안·정책 캐비엇 예외](#3-보안정책-캐비엇-예외--왜-길이-제한-밖인가-그리고-왜-양방향인가)`), 그리고 (diff 밖, `Read` 로 직접 확인) `spec/conventions/swagger.md:471`(`### §3 보안·정책 캐비엇 예외 — 왜 길이 제한 밖인가, 그리고 왜 양방향인가`)·`:473`(`**왜 예외인가** (2026-08-17):`)
  - 상세: 새로 삽입된 콜아웃(272행)은 "DTO 길이가 강제가 아니게 된 이상 '예외' 라는 틀은 성립하지 않는다... 그래서 면제가 아니라 지시로 뒤집는다" 라고 명시적으로 프레임을 전환한다. 그런데 바로 다음 줄부터는 **그 전에 있던 문단·링크·Rationale 서브섹션이 그대로 남아 있고**, 전부 옛 "예외" 프레임을 그대로 쓴다 — 같은 콜아웃 안의 근거 링크 텍스트(286행)도 "§3 보안·정책 캐비엇 **예외**"라 부르고, 링크가 가리키는 Rationale 서브섹션 자체(471·473행)도 제목·첫 문장이 "왜 **예외**인가"로 시작해 새 프레이밍을 전혀 반영하지 않는다. `/consistency-check`(`11_59_11`)의 Cross-Spec WARNING 2가 정확히 이 지점("캐비엇 절을 재정의하거나 톤을 낮춰 재작성")을 지적했고, 앞쪽 상단 표·콜아웃은 그 지적을 반영했지만 **그 지적이 가리키는 Rationale 서브섹션 본문은 손대지 않은 채 남았다** — 같은 문서 안에서 "예외"라고 부르는 곳과 "지시"라고 부르는 곳이 공존해, 다음에 이 문서를 읽는 사람이 어느 쪽이 최신 판단인지 헷갈릴 수 있다.
  - 제안: `spec/conventions/swagger.md:471` 헤딩과 `:473` 첫 문장을 새 "지시" 프레이밍에 맞게 갱신하거나(예: "왜 길이 제한과 무관하게 반드시 적어야 하는가"), 최소한 그 서브섹션 상단에 "2026-08-23 예외→지시 재정의 반영" 각주를 달아 286행 링크 텍스트와 정합시킨다. 코드 변경이 아니라 같은 PR 안 spec 문서 자체의 자기모순이므로 fix 는 developer/`resolution-applier` 가 이 파일을 직접 재편집하는 것으로 충분하다(별도 planner 턴 불요 — 이미 그 PR 이 손댄 문서·섹션 안이다).

- **[INFO]** `execute-workflow.dto.ts`/`workflows-execute-body.spec.ts`/`swagger.md` 나머지 변경은 기능 완전성·spec 정합성 모두 검증됨.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:66`(`deprecated: true` 추가), `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:163-168`(신규 가드+대조군)
  - 상세: (1) `jest workflows-execute-body.spec.ts` 직접 실행 — 10/10 PASS. (2) `deprecated: true` 를 주석 처리하는 뮤테이션을 적용해 재실행한 결과 신규 단언 **정확히 1건만 RED**, 나머지 9건 GREEN — plan(`swagger-decisions.md`)의 뮤테이션 주장과 실측이 일치(뮤턴트 적용 후 `cp` 백업으로 원복, `git diff` 로 원상 확인 완료). (3) 대조군(`parameterValues` 는 `deprecated` 가 아니어야 한다)도 같은 테스트 안에 존재해 "둘 다 deprecated" 회귀도 잡는다. (4) `{@link ExecuteNodeDto.input}` 참조가 실제로 `execute-node.dto.ts:31` 의 `input` 필드를 정확히 가리킴 확인. (5) `swagger.md` 신설 실측 표(요청 116/335=34%, 응답 58/128=45%, 전체 174/463=37%) 산술 검산 일치, 신규 앵커(`#3-dto-길이는-왜-강제가-아닌가`)는 기존 문서의 슬러그 관례(예: `discriminator 는 판별자가 sound 할 때만 (§1-4)` → `#discriminator-는-판별자가-sound-할-때만-1-4`)와 동형이라 깨진 링크 아님. (6) `execute` 엔드포인트 여분 키 미거부 유지(코드 무변경)·`ExecuteWorkflowDto.input` 리네임 대신 `deprecated` 표시·`swagger.md §3` DTO 길이 비강제화 세 결정 모두 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커 항목과 1:1 대응하고 체크박스 `29→26` 실측 확인(`git show` 전/후 `- [ ]` 카운트). TODO/FIXME/HACK/XXX 신규 도입 없음.
  - 제안: 없음 (정보성).

## 요약
이번 PR 은 런타임 로직을 전혀 바꾸지 않고 (a) `ExecuteWorkflowDto.input` 에 `deprecated: true` 플래그와 이를 고정하는 가드+대조군 테스트를 추가하고 (b) `swagger.md §3` 의 DTO 설명 길이 규칙을 "강제"에서 "지향"으로 재정의하며 보안·정책 캐비엇을 "예외"에서 "적극 지시"로 뒤집고 (c) 세 결정을 트래커에 종결 기록한 문서 전용 변경이다. 코드 변경분(파일 1·2)은 테스트 실행과 뮤테이션 검증으로 기능 완전성이 실측 확인됐고 spec(swagger.md)과 line-level 로 일치한다. 유일한 흠은 spec 문서 자체 내부의 자기모순 — §3 캐비엇을 "예외→지시"로 재정의한다고 신설 문단에 못박아 놓고도, 그 문단이 링크로 가리키는 기존 Rationale 서브섹션(제목·첫 문장)은 옛 "예외" 프레이밍 그대로 남겨 둬 같은 문서 안에서 두 서술이 공존한다. 코드 결함이 아니라 이번 PR 이 직접 편집한 spec 문서의 반쪽짜리 반영이므로 CRITICAL 이 아니라 WARNING 이다.

## 위험도
LOW
