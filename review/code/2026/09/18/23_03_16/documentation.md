# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 신규 마이그레이션·spec·e2e 전부가 아직 존재하지 않는 `plan/complete/spec-draft-fk-remaining-dispositions.md` 를 순방향 인용한다
  - 위치: `codebase/backend/migrations/V121__edge_target_node_id_index.sql:4`, V122~V130 동일 파일 4번째 줄(10개 파일 전부), `spec/1-data-model.md`(신규 Rationale 절 «출처» 각주, `### 쓸 인덱스가 없는 FK 서른하나의 처분` 하단), `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`(JSDoc `* - V121~V130 · … 근거·실측:` 줄)
  - 상세: 위 파일들이 공통으로 `plan/complete/spec-draft-fk-remaining-dispositions.md` 를 가리키지만, 현재 저장소 상태(`git status`)에서 이 draft 는 아직 `plan/in-progress/spec-draft-fk-remaining-dispositions.md` 에 있다(`find plan -iname` 로 직접 확인). V117`.sql`(`plan/complete/spec-draft-graph-fk-indexes.md`) 등 선례를 보면 이 프로젝트 관례는 "구현 SQL 이 최종 경로를 미리 인용하고, PR 마지막 커밋에서 plan 을 `complete/` 로 옮겨 링크를 채운다" 는 방식이라 지금 상태 자체는 결함이 아니다. 이 draft 자신의 체크리스트에도 "트래커 반영 · 부록 반영 · 이 draft `complete/` 이동(마지막 커밋). 이동 뒤 `grep -rln … spec codebase` 로 인용 전부가 실재 경로를 가리키는지 확인" 이 명시돼 있고, `review/consistency/2026/09/18/22_44_08/SUMMARY.md` INFO#2 도 동일 지점을 이미 짚어 `--impl-done` 체크리스트로 넘겨 두었다.
  - 제안: 새로 지적할 필요는 없음(이미 계획·검토에 반영됨). 다만 이 PR 을 병합하기 전 마지막 단계에서 `git mv plan/in-progress/spec-draft-fk-remaining-dispositions.md plan/complete/` 실행 후 `grep -rln "plan/in-progress/spec-draft-fk-remaining-dispositions.md" spec codebase plan` 이 0건인지 반드시 재확인할 것 — 이 문자열이 SQL 마이그레이션 10개 파일에 박혀 있어 실수로 빠뜨리면 배포된 마이그레이션 주석에 깨진 링크가 영구히 남는다(마이그레이션은 append-only 라 소급 수정이 사실상 불가능하다는 점이 다른 절보다 리스크가 크다).

## 요약

이번 변경은 V121~V130 마이그레이션 10쌍(.conf/.sql), e2e 스펙 갱신, `spec/1-data-model.md`·`spec/data-flow/*.md` 6개 문서, 그리고 이를 뒷받침하는 plan draft 로 구성된다. SQL 헤더 주석은 파일마다 근거·실측 수치·처분 기준·롤백 절차를 자기완결적으로 담고 있고, 그 수치들을 plan draft(`plan/in-progress/spec-draft-fk-remaining-dispositions.md`)의 실측 표와 전수 대조한 결과 10개 파일 전부(캔버스 저장·워크플로 삭제·워크스페이스 삭제 비용, 크기, 쓰기 비용, partial 사유)가 소수점까지 일치했다. `spec/1-data-model.md` 의 §3 인덱스 표 10행 추가와 `## Rationale` 신규 절, 그리고 `spec/data-flow/{2-auth,6-knowledge-base,7-llm-usage,10-triggers,11-workflow,12-workspace}.md` 의 sink 행 갱신도 plan 의 S1~S4 변경안과 문자열 단위로 일치했으며, 앞선 consistency-check(22:33:00) 가 지적한 "Trigger (workflow_id) 절 상호참조 누락" WARNING 도 이번 diff 의 S3 넷째 정정 문단으로 이미 반영돼 있다. `README.md §5` 인용("신규 추가에도 0) 을 둡니다")과 e2e JSDoc 의 SoT 각주도 원문과 정확히 일치한다. 유일하게 남는 것은 12곳(SQL 10개 + spec 1 + e2e 1)이 아직 `plan/in-progress/` 에 있는 draft 를 `plan/complete/` 경로로 미리 인용하는 점인데, 이는 이 저장소의 기존 관례(V117 선례)이자 draft 자신의 체크리스트·이전 consistency-check 가 이미 "마지막 커밋에서 이동 + grep 검증" 으로 추적 중인 항목이라 결함이 아니라 마감 단계에서 놓치지 않아야 할 사항으로만 남긴다. 전반적으로 문서화 품질은 이 저장소의 상위 수준(수치 재현 가능성, 정정 각주 관례 준수, SoT 상호참조)을 그대로 유지하고 있다.

## 위험도
NONE
