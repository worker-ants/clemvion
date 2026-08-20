# Plan 정합성 검토 — `spec/5-system/` (impl-prep, `eia-inputdata-marker-guard`)

## 검토 방법

`spec-draft-inputdata-egress-masking.md`(planner draft)가 `Execution.inputData` egress
마스킹 카브아웃을 닫으며 예고한 문서별 변경안(①~⑦)을 target(`spec/5-system/`) 번들과
대조했다. 번들 예산 절단으로 본문이 생략된 관련 plan(`spec-sync-websocket-protocol-gaps.md`
등)은 파일시스템에서 직접 재조회했고, target 범위 밖이지만 같은 결정을 미러하는
`spec/1-data-model.md`·`spec/3-workflow-editor/3-execution.md`·
`spec/4-nodes/1-logic/12-background.md`도 실측 대조했다(코드 측 `execution-response.dto.ts`·
`background-runs.service.ts`도 교차 확인).

## 발견사항

없음 — CRITICAL/WARNING 없음.

## 참고 (INFO)

- **INFO** — 트래커 체크박스 미반영은 예상된 상태
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "~~잔여 ②~~ 해소(2026-08-20)"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:6067`
    "`inputData` egress 마스킹 — 프런트 마커 가드가 선행돼야 한다" (여전히 `- [ ]`)
  - 상세: target spec 은 이미 "해소(2026-08-20)"로 서술을 완료했으나, 이 항목을 등재한
    상위 트래커의 체크박스는 아직 미완이다. 이는 결함이 아니라 `eia-inputdata-marker-guard.md`
    의 "착지 순서" 절이 명시한 설계다 — spec 커밋이 먼저 서고 같은 PR 의 후속 커밋이
    가드·backend 를 붙인 뒤 트래커를 닫는다. 지금은 `--impl-prep` 재실행 단계이므로 구현
    착수 전이고, spec 이 구현보다 앞서 나가는 것은 계획된 상태다.
  - 제안: 조치 불요. `eia-inputdata-marker-guard.md`·`spec-draft-inputdata-egress-masking.md`
    가 같은 PR 로 착지할 때 이 트래커 항목을 함께 닫으면 된다(이미 plan 체크리스트에
    "트래커 항목 종결"로 등재돼 있음).

- **INFO** — 번들 예산 절단으로 일부 관련 plan 본문이 생략됨
  - target 위치: (검토 인프라) `_prompts/plan_coherence.md`
  - 관련 plan: `plan/in-progress/spec-sync-websocket-protocol-gaps.md`,
    `plan/in-progress/spec-draft-eia-62-waiting-payload.md`,
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 등
  - 상세: 이 세 plan 은 target 파일(`6-websocket-protocol.md`, `14-external-interaction-api.md`)
    의 `pending_plans`/관련 결정에 직접 연결되지만 번들에서 "본문 생략됨 — 컨텍스트 예산 초과"
    로 절단되어 있었다. 파일시스템에서 직접 열어 대조한 결과 `inputData` 마스킹 전환과
    충돌하는 서술은 없었다(websocket-protocol-gaps 는 `auth.token_expired`/`system.maintenance`/
    server ping 잔여만 다루고 inputData 언급 없음). 이번 세션에는 실제 충돌이 없었지만,
    프롬프트 조립 예산이 관련 plan 을 조용히 떨어뜨리는 구조적 갭은 여전하다
    (`feedback_consistency_spec_mode_budget` 계열의 재발 형태).

## 정합성 확인 근거 (교차 대조 결과)

- `spec/5-system/14-external-interaction-api.md` §R17: "잔여 ②" 가 취소선+해소로 flip,
  판단 기준 문단(외부 노출 단일축 → 외부 노출+미러 유지비 2축)·비교표(`함`/`안 함`)·
  캐너리 방향(①·②·⑧·⑧-b vs ⑤·⑥-b) 전부 draft 안대로 반영됨. `frontmatter code:` 에
  `rerun-modal.tsx`·`editor-toolbar.tsx` 등재 확인.
- `spec/5-system/13-replay-rerun.md` §10.2: caveat 블록이 "마스킹 대상이 아니다" →
  "마스킹된다 — 이 모달이 마커 가드를 갖는다"로 전면 재작성됨. `제출 차단`(안내 아님) 동작
  명시. `frontmatter code:` 에 `rerun-modal.tsx` 등재 확인.
- `spec/5-system/12-webhook.md` §5.3: "유일한 방어" → "이중 방어"(ingestion key-blacklist +
  egress 값-패턴)로 갱신, ingestion 층이 대체되지 않는 이유(`$trigger.headers` egress
  미경유)도 유지됨.
- `spec/5-system/6-websocket-protocol.md` §4.1: "가르는 축은 레벨" 프레임이 폐기되고
  "두 레벨이 REST·WS 전부에서 같은 규칙" 으로 대체됨.
- `spec/1-data-model.md` §2.13/§2.14 (target 범위 밖, 직접 확인): `Execution.input_data`·
  `NodeExecution.input_data` 양쪽 다 "egress 마스킹 대상" 으로 갱신, 두 레벨 대비 서술 소멸.
- `spec/3-workflow-editor/3-execution.md` §2.2 (target 범위 밖, 직접 확인): 히스토리 로드
  행에 마커 잔존 시 Run 비활성 캐비엇 삽입됨.
- 번들 전체에서 `MASKED_INPUT_DATA_REASON` 인용은 plan 문서(향후 삭제 대상 인용 자체를
  기록하는 문맥)에만 남아 있고, 실제 spec 본문에는 이미 남아 있지 않음(코드 쪽
  `execution-response.dto.ts`·`background-runs.service.ts` 는 여전히 인용 — 이는 예정된
  backend 구현 착수 대상이라 정상적인 pre-implementation 상태).

## 요약

target(`spec/5-system/`)은 `eia-inputdata-marker-guard.md`/`spec-draft-inputdata-egress-masking.md`
가 예고한 `Execution.inputData` 카브아웃 폐지 결정을 R17·webhook·websocket-protocol·
replay-rerun 네 문서에 걸쳐 정확히, 그리고 번들 범위 밖의 미러 문서(`1-data-model.md`,
`3-workflow-editor/3-execution.md`, `4-nodes/1-logic/12-background.md`)까지 빠짐없이
반영했다. 미해결 결정을 우회하는 서술이나 선행 plan 미해소, 후속 항목 누락은 발견되지
않았다 — 유일하게 "미완"으로 보이는 트래커 체크박스는 spec-먼저-구현-나중이라는 이 plan
자체의 명시적 착지 순서에 부합하는 정상 상태다. `--impl-prep` 재실행 관점에서 spec 쪽은
구현 착수를 막을 사유가 없다.

## 위험도

NONE
