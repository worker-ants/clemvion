# Rationale 연속성 검토 — `plan/in-progress/spec-draft-deletion-releases-trigger-resources.md`

## 검토 방법

target draft 가 인용·번복·확장하는 과거 결정을 실제 spec 파일에서 직접 대조했다(번들 프롬프트가
컨텍스트 예산으로 절단한 `secret-store.md` · `data-flow/10-triggers.md` · `data-flow/11-workflow.md` ·
`data-flow/12-workspace.md` · `5-system/15-chat-channel.md` · `data-flow/1-audit.md` · `2-trigger-list.md`
전체는 저장소에서 직접 읽었다). `plan/complete/trigger-config-lost-update.md` 의 5·14라운드 처분도
원문 대조했다.

## 발견사항

- **[INFO]** `chat-channel.md` R8 의 «teardownChannel() (또는 `TriggersService.remove`)» 단일 경로
  표기가 새 "모든 경로" 규칙에 비해 여전히 좁다 — 단, D1 규칙과 모순되지 않는다
  - target 위치: 없음 (draft 가 이 파일을 건드리지 않음 — 비대상 표에도 R8 은 미등재)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` R8 "Fan-out facade 의 분리" —
    *"`teardownChannel()` (또는 `TriggersService.remove`) 시 해당 `triggerId` 의 entry 를 반드시
    unregister"*
  - 상세: 이 draft 는 `secret-store.md §R4` 가 "트리거 삭제 경로 하나만 주어로 삼아 나머지 세 경로가
    계약 밖에 있었다" 는 것과 **똑같은 클래스**의 결함을 스스로 발견해 §2.1·§5.3·§6·§R4 전수를
    고친다(S9·S10). 그런데 listener registry 도 D1 의 정리 대상 넷 중 하나(표: "listener registry |
    빠지면 인메모리 유령 엔트리")로 명시하면서, 같은 좁은-주어 문제를 안고 있는 `chat-channel.md` R8
    은 비대상 표에서도 언급하지 않고 그대로 둔다. R8 의 핵심 주장("teardownChannel 호출 시 반드시
    unregister")은 D1·D3(외부 자원은 트랜잭션 밖에서 해제, `TriggersService.remove()` 와 같은 순서)
    와 충돌하지 않으므로 **위반은 아니다** — 다만 괄호 안의 "TriggersService.remove()" 라는 특정 호출
    경로 명명이, 워크플로·워크스페이스·스케줄 삭제 경로가 그 메서드를 거치지 않고도 같은 정리를 하게
    되는 새 설계 아래서는 문면상 좁아진다.
  - 제안: 조치 불요로 볼 수도 있으나, 같은 PR 계열에서 `secret-store.md` 를 전수 정정한 선례가 있으므로
    구현(DRT-2) 착수 시 R8 의 "(또는 `TriggersService.remove`)" 괄호를 "(또는 스케줄·워크플로우·
    워크스페이스 삭제 경로의 정리 단계)" 정도로 넓히는 것을 후속 트래커 항목에 한 줄 추가해 두면
    같은 drift 가 재발하지 않는다.

## 확인한 continuity 정합 — 반례를 찾지 못한 지점 (참고용, 위험 아님)

- **`secret-store.md §R4` "ON DELETE CASCADE 는 채택하지 않는다"** — D1~D7 은 트리거 행 삭제 자체는
  기존대로 FK CASCADE 에 맡기되(D2), `secret_store` 정리는 여전히 application-level 명시 코드
  (`deleteByPrefix`)로 남긴다. R4 의 핵심 원칙("implicit DB 동작과 explicit application 동작을
  섞지 않는다")을 그대로 보존하며 위반하지 않는다.
- **"철회한 1차안"(워크스페이스 삭제가 `secret_store` 를 `workspace_id` 로 트랜잭션 안에서 명시
  DELETE)** — 1차 `--spec` 이후 이 draft 내부에서 스스로 기각하고 `secret-store.md §3.4`(백엔드
  swap 가능성을 위해 인터페이스에 워크스페이스 단위 삭제를 두지 않음)에 근거를 댄 뒤, D6 로 같은
  목적을 트리거 단위 prefix 로 재구현했다 — 번복에 새 근거가 붙어 있다.
- **트리거 목록 §3 "외부 provider 호출은 락 밖" 원칙** — D3·D5 모두 provider teardown·secret 쓰기를
  트랜잭션·advisory lock 밖에 유지한다. draft 가 인용하는 "Cafe24 토큰 갱신이 advisory lock 을
  기각한 사유" 문장은 실제로 `2-trigger-list.md` 190~199행에 존재하는 문구를 정확히 재인용한 것으로
  확인했다(지어낸 선례 아님).
- **`data-flow/1-audit.md` "workspace.deleted 는 의도적 미기록 — `audit_log.workspace_id` 의
  ON DELETE CASCADE 때문"** — DRT-2 의 "부수 주의"("커밋 뒤 정리 단계는 이미 지워진 `workspace_id`
  를 참조하는 감사 행을 남기지 않는다(FK 위반)")가 이 기존 제약을 정확히 계승해 새 secret 정리
  단계에도 같은 주의를 붙였다. 위반이 아니라 올바른 확장이다.
- **"«비활성화» 를 오기로 판정"** — `1-workflow-list.md` 의 "비활성화" 문구는 그 문서의 기존
  `## Rationale` 4개 항목 어디에도 의도된 결정으로 등재돼 있지 않다(직접 대조 확인). `trigger.workflow_id
  NOT NULL … ON DELETE CASCADE`(V001)와 모순되는 서술을 데이터 모델 SoT 에 맞춰 고치는 것이라
  "기각된 대안의 재도입"이 아니라 drift 수정이다.
- **`data-flow/10-triggers.md §1.4`** — S5 가 추가하는 "Workflow·Workspace 삭제" 행은 기존 표 형식
  (경로 → 효과 → 세부)과 정확히 대칭이며, 데이터 흐름 디렉토리의 frontmatter 부재 관례상
  "미구현 (Planned)" 인라인 표기(W1 처분에서 인용)도 `data-flow/8-notifications.md`·
  `data-flow/9-observability.md` 에 이미 있는 동일 패턴과 일치한다.

## 요약

target draft 는 이 워크트리의 세 라운드 `--spec` 검토를 거치며 자기모순(1차 BLOCK)을 이미 대폭
정리한 상태이고, 이번 실측에서 추가로 확인한 바로도 과거 Rationale 과의 정합성이 높다. 결정을
번복하는 세 자리(D4 의 secret 정리 순서 반전, 「철회한 1차안」, 「비활성화 → 삭제」 재분류) 모두
새 근거를 명시적으로 함께 적었고, 원용하는 과거 선례(Cafe24 advisory lock 기각·audit_log CASCADE
무기록 원칙·secret-store §3.4 인터페이스 경계)는 실제 spec 원문과 대조해 실재를 확인했다. 유일하게
발견한 잔여 항목은 `chat-channel.md` R8 의 좁은 경로 명명이 새 "모든 경로" 규칙 아래서 문면상 낡을
수 있다는 INFO 수준 사안으로, D1 원칙과 직접 충돌하지는 않는다.

## 위험도

LOW
