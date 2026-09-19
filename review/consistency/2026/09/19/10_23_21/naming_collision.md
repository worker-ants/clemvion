# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-code-guards-and-change-summary.md`

## 발견사항

이 target 문서는 새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV 변수를 전혀 도입하지 않는다. 도입하는
유일한 "신규 식별자"는 `spec/1-data-model.md` frontmatter `code:` 목록에 새로 등재하는 파일 경로 세 개다. 이를
전수 대조한 결과 충돌은 없다.

- **[INFO]** 신규 `code:` 경로 세 개는 충돌 없음 — 이미 존재하는 파일이며 자기 docstring 이 이미 이 spec 을 SoT 로 선언
  - target 신규 식별자: `code:` 에 새로 추가되는 세 경로
    - `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`
    - `codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts`
    - `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`
  - 기존 사용처: `spec/2-navigation/2-trigger-list.md`·`3-schedule.md`·`spec/4-nodes/7-trigger/providers/{slack,discord}.md`·`spec/5-system/{7-llm-client,15-chat-channel}.md`·`spec/conventions/{secret-store,user-guide-evidence}.md` — 이들 `code:` frontmatter 를 전수 확인했으나 위 세 경로는 어디에도 등장하지 않는다(`grep -rn` 결과 `spec/1-data-model.md` 본문 1196행의 서술적 언급 1건뿐, 그것도 `plan/complete/...md` 경로지 e2e 파일 경로가 아니다).
  - 상세: 세 파일은 이미 저장소에 존재하며(각각 `plan/complete/spec-draft-deletion-cascade-indexes.md`·`plan/complete/spec-draft-webhook-endpoint-path-global-unique.md`·`plan/complete/entity-schema-declaration-drift.md` 로 이미 구현·머지됨), 세 파일 모두 자기 docstring 에서 `spec/1-data-model.md`(또는 그 Rationale 절)를 이미 SoT 로 명시하고 있다(`entity-schema-declarations.e2e-spec.ts`: "근거·실측: `plan/complete/entity-schema-declaration-drift.md`"·`trigger-endpoint-path-dedupe.e2e-spec.ts`: "SoT: `spec/1-data-model.md` `## Rationale` «Webhook `endpoint_path` 전역 유일»"). 따라서 target 의 `code:` 등재는 이미 실질적으로 성립해 있던 관계를 frontmatter 에 명시화하는 것이지, 다른 의미로 쓰이던 이름을 재사용하는 것이 아니다. `2-trigger-list.md` 가 이미 등재한 `endpoint-path-conflict-wrap*.ts`(AST 가드, `TRIGGER_ENDPOINT_PATH_CONFLICT` 런타임 계약)와 이름이 유사해 보일 수 있으나, 그것은 앱 레벨 write-time 방어이고 `trigger-endpoint-path-dedupe.e2e-spec.ts` 는 V131 마이그레이션의 1회성 정리 SQL 을 검증하는 별개 파일이라 실질적 충돌이 아니다.
  - 제안: 없음 — 변경 불필요.

- **[INFO]** 이전에 명시적으로 유보됐던 게이트 스코프 결정과의 정합 확인 — 충돌 아님, 오히려 후속 이행
  - target 신규 식별자: 위와 동일 (`code:` 3건 추가)
  - 기존 사용처: `plan/complete/spec-draft-data-model-fk-actions.md` 161~163행 «비대상» — "frontmatter `code:` 에 `entity-schema-declarations.e2e-spec.ts` 넣기: 넣지 않는다 … 사실 정정 PR 에서 정할 일이 아니다."
  - 상세: 완료된 선행 PR 이 "하나만 넣으면 어긋나고 셋을 넣으면 게이트 범위 결정이 된다"며 이 결정 자체를 별도 PR 로 명시적으로 미뤘다. target 문서는 정확히 그 미뤄둔 결정을 셋 전부 등재하는 방식으로 내리는 후속 PR이다 — 이름 충돌이 아니라 예정된 후속 조치이며, "하나만 넣지 않는다"는 선행 PR 의 우려(부분 등재로 인한 비일관)도 target 이 셋 전부를 넣음으로써 해소한다.
  - 제안: 없음. 참고로 target 본문에 이 선행 결정을 교차 인용해 두면(선행 PR 번호/경로 명시) 다음 사람이 "왜 지금 결정하나"를 더 빨리 파악할 수 있으나 필수는 아니다.

`change_summary` 관련 §8.1 정정문은 기존 서술을 코드·타 spec(§7.4·§9·data-flow)에 맞추는 사실 정정일 뿐, 새 용어·엔티티·필드명을 도입하지 않는다(`changeSummary`/`Restored from vN` 모두 기존 코드·spec 표현 재사용). 요구사항 ID, API endpoint, 이벤트명, ENV 변수, 파일 경로 명명 컨벤션 위반 어느 관점에서도 신규 식별자 충돌은 발견되지 않았다.

## 요약

target 문서가 새로 도입하는 식별자는 사실상 `spec/1-data-model.md` frontmatter `code:` 에 등재하는 e2e 파일 경로 세 개뿐이며, 이들은 이미 존재하는 파일이고 각 파일 docstring 이 이미 이 spec 을 SoT 로 선언하고 있어 다른 spec 의 `code:` 목록·기존 명명 컨벤션과 전수 대조한 결과 충돌이 없다. `change_summary` 서술 정정은 신규 식별자를 도입하지 않는 순수 사실 정정이다. 신규 식별자 충돌 관점에서는 문제 없음.

## 위험도

NONE
