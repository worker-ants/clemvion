# 신규 식별자 충돌 검토 — spec/2-navigation/ (--impl-prep)

## 검토 범위 확인

전달된 payload 는 `spec/2-navigation/` 영역 전체(0-dashboard, 1-workflow-list, 10-auth-flow, 13-error-empty-loading, 14-execution-history, 15-system-status, docs, _product-overview 등) 배경 컨텍스트를 포함한다. 작업 폴더명(`execution-detail-node-subtabs`)과 `spec/2-navigation/14-execution-history.md` §3.3~§3.4.2("노드 결과 패널" 서브 탭 — Preview/Input/Output/LLM Usage/Config/Error, 메시지 레벨 Response/Request/LLM Usage) 내용으로 볼 때, 실질적 신규 도입분은 이 절이다. 저장소 HEAD(`git show HEAD:spec/2-navigation/14-execution-history.md`)와 payload 내용이 바이트 단위로 일치(521줄 동일) — 즉 이 spec 은 이미 커밋된 상태이며, 본 검토는 그 내용을 기준으로 한 구현 착수 전(`--impl-prep`) 신규 식별자 충돌 점검이다.

## 발견사항

### 신규 식별자 충돌 — 발견 없음 (검증한 항목)

아래 항목들은 "새 이름이 기존과 겹치는가" 관점에서 육안상 의심되어 교차 검증했으나, 전부 **동일 개념의 의도된 재사용/공유**이거나 **문서 내에서 이미 명시적으로 구분**되어 있어 CRITICAL/WARNING 대상이 아니다.

- **탭 이름 `Preview/Input/Output/Config/Error` + `LLM Usage`**: `14-execution-history.md` §3.3·EH-DETAIL-03 과 `spec/3-workflow-editor/_product-overview.md` ED-EX-12/13/14, `spec/3-workflow-editor/3-execution.md` §"Response/Request/LLM Usage" 가 동일 이름을 사용한다. 두 화면(에디터 Run Results 드로어 vs 실행 이력 상세 페이지)이 의도적으로 동일 UX 언어를 미러링한 것으로 보이며, 상호 참조는 없지만 값/의미가 완전히 동일해 충돌이 아니라 **일관성 있는 재사용**이다.
- **`triggerSource` (DTO 필드, 5종: subworkflow/manual/schedule/webhook/unknown) vs `__triggerSource` (엔진 내부 마커, 3종: manual/webhook/schedule)**: 이름이 매우 유사해 혼동 가능성이 있으나, `14-execution-history.md` Rationale R-2 가 "값 집합·레이어가 다른 별개의 식별자"임을 이미 명시적으로 기술하고 있다. 즉 문서 스스로 잠재적 혼동을 인지하고 선제 disambiguate 했다 — 이미 해결된 사안.
- **요구사항 ID `EH-DETAIL-01~11`**: 전체 spec 트리에서 `EH-` 계열 접두사는 `EH-DETAIL-*` / `EH-LIST-*` / `EH-NAV-*` 세 그룹만 존재하며 전부 `14-execution-history.md` 소유. 타 문서가 같은 ID 를 다른 의미로 쓰는 사례 없음.
- **API endpoint `POST /api/executions/:executionId/re-run`, `GET /api/executions/:executionId/chain`**: `spec/5-system/13-replay-rerun.md` §8.1/§8.2 가 SoT 로 먼저 정의하고, `14-execution-history.md` §5 는 동일 endpoint 를 참조·재기술한다(`EH-DETAIL-10/11` 로 교차 링크). 새 endpoint 재정의가 아니라 동일 계약의 화면측 소비 기술.
- **i18n 키 `history.rerun.*`, `workflows.executionHistory`**: 전부 `13-replay-rerun.md` §10.4 또는 기존 `1-workflow-list.md` §2.6 문서와 문자 그대로 동일값 공유. 신규 키 재정의 충돌 없음.
- **DB 컬럼 `chain_id`/`re_run_of`**: `spec/1-data-model.md` §2.13 Execution 에 이미 존재하는 컬럼(V067)이며 본 spec 은 이를 참조만 한다. `previous_execution_id`(단일 노드 실행 seed) 등 이름이 비슷한 인접 컬럼과의 의미 차이도 data-model 문서가 이미 명시.

## 요약

`spec/2-navigation/14-execution-history.md` 의 실행 상세 노드 서브탭(§3.3~§3.4.2) 관련 신규/변경 식별자 — 탭 이름, `triggerSource` DTO 필드, `EH-DETAIL-*` 요구사항 ID, Re-run/Chain endpoint, i18n 키 — 를 전수 대조한 결과 기존 사용처와 다른 의미로 충돌하는 사례는 발견되지 않았다. 유사해 보이는 이름들(에디터 Run Results 탭 구성, `triggerSource` vs `__triggerSource`)은 모두 의도된 재사용이거나 문서 내부에서 이미 명시적으로 구분되어 있어 별도 조치가 필요 없다.

## 위험도

NONE
