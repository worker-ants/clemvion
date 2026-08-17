# Plan 정합성 검토 — spec/5-system/ (EIA masking round 2, --impl-prep)

## 조사 방법

`spec/5-system/` 중 마스킹(egress redaction) 작업과 직결되는
`14-external-interaction-api.md`(§R17 마스킹 카탈로그, 프롬프트 예산 초과로 생략돼 직접
`Read`) · `6-websocket-protocol.md`(§4.1 값-패턴 마스킹 캐비엇) · `3-error-handling.md`·
`4-execution-engine.md`(프롬프트 포함분)를 대조군으로 삼고, `plan/in-progress/` 중
"마스킹|masking|R17" 을 언급하는 전 파일(`spec-sync-external-interaction-api-gaps.md`
[정본 트래커] · `eia-terminal-payload.md` · `spec-draft-eia-62-waiting-payload.md` ·
`ie-resume-turn-boundary-cancel.md` · `retry-turn-terminal-guard.md` · `eia-context-schema-followups.md`
· `spec-draft-eia-notification-payload-contract.md` 등)를 대조했다. `git log` 로 현재
HEAD(`89c3f3c53`, #1180)가 이미 origin/main 이고 워킹트리가 clean 함을 확인 — 이번 라운드는
"직전 diff 검토" 가 아니라 **다음 작업 착수 전 spec-plan 정합성 스냅샷**이다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 확인만 해 두는 INFO다.

- **[INFO]** 정본 트래커의 "결정 필요" 항목은 target 에도 미결로 정확히 미러돼 있다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ③"(라인
    1554~1560, workflow-assistant LLM 도구의 `inputData`/`outputData`/`error` 마스킹
    의미 — 값-패턴 vs 키-기반 접미힌트 중 우선순위)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 라인 225~233
    ("어느 마스킹 의미가 우선하는지는 별도 결정이라 분리했다")
  - 상세: target 문서가 이 축을 **선결정하지 않고** "별도 결정" 으로 정확히 열어 둔 상태이며,
    plan 도 같은 문구로 미결을 유지한다. 두 문서가 어긋나지 않는다 — round 2 에서 이 갭을
    다룬다면 코드 착수 전에 이 택일(사용자 결정)이 선행돼야 한다는 점만 재확인.
  - 제안: 조치 불요. round 2 착수 시 이 항목을 고를 경우, 구현 전에 사용자 결정을 먼저
    받을 것(계획 그대로).

- **[INFO]** `kb:{documentId}` / `background:run:{id}` WS 채널의 값-패턴 마스킹 미적용은
  target·plan 양쪽에서 일관되게 "아직 안 했다" 로 남아 있다
  - target 위치: `spec/5-system/6-websocket-protocol.md` 라인 126·153~154·193 (이 두 채널은
    §4.1 "값-패턴 마스킹" 캐비엇의 적용 대상 목록 — `execution`/`node` 이벤트 — 에 없음)
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md` 라인 286~291 ("검토 대상으로
    남긴다 — 외부 fanout 이 없어 이번엔 닫지 않음")
  - 상세: target 이 이 두 채널의 마스킹을 "이미 구현됨" 으로 잘못 서술하고 있지 않음을
    확인. 충돌 없음.
  - 제안: 조치 불요.

- **[INFO]** 두 개의 순수 "운영/정책 판단" 항목이 코드 범위 밖에서 여전히 열려 있다
  - target 위치: 해당 없음(spec 본문이 아니라 CHANGELOG/plan 에만 기록됨)
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` §"⚠️ 외부 구독자 breaking change"
    (활성 outbound 구독자 유무 확인 필요) · `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
    라인 327~333("이미 유출된 데이터에 대한 사후 대응 — 운영 판단 필요")
  - 상세: 둘 다 "코드가 아니라 운영 판단" 으로 명시 분리돼 있고 target 은 이에 대해 어떤
    주장도 하지 않는다. round 2 가 이 두 항목을 코드로 해결하려 하면 범위 오판이 된다는
    점만 상기.
  - 제안: round 2 착수 시 스코프에서 배제(계획 그대로 유지).

## 요약

`spec/5-system/14-external-interaction-api.md` §R17 마스킹 카탈로그와 `6-websocket-protocol.md`
§4.1 값-패턴 마스킹 캐비엇은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
(정본 트래커)가 2026-08-16~17 에 걸쳐 닫은 결정(내부 읽기 경로 마스킹·`NodeExecution.error`·
`inputData` 레벨별 카브아웃·WS node/비종결 emit 자유 텍스트 마스킹 등)을 빠짐없이, 그리고
**아직 열린 항목**(workflow-assistant 도구 마스킹 우선순위·`SECRET_LEAK_PATTERNS` 의
`token=`/연결문자열 갭·`kb:`/`background:run:` 채널·WS 대기-재개 재사용 점검·운영 판단 2건)
은 target 이 선결정하지 않고 정확히 미결로 남긴 상태로 미러하고 있다. target 이 plan 의
미해결 결정을 우회하거나, plan 이 전제하는 사전조건을 target 이 깨거나, target 변경이 다른
plan 의 후속 항목을 무효화하는 사례를 찾지 못했다. 두 문서는 이례적으로 촘촘하게
교차참조돼 있다(같은 날짜·같은 세션 ID 를 서로 인용).

## 위험도
NONE
