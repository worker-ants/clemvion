# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음 (5개 checker 전원 CRITICAL 0건, 전문 전원 확보)

## 전체 위험도
**LOW** — Cross-Spec/Rationale Continuity/Convention Compliance/Naming Collision 은 NONE. Plan Coherence 가 WARNING 1건(신규 Rationale 절이 남기는 자기모순 위험)을 제기해 전체를 LOW 로 끌어올림.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | S3 로 신설되는 Rationale 절이 바로 아래 기존 절("삭제 연쇄의 FK 인덱스 다섯")의 "32개 남음 · 지식 베이스 연쇄가 다음 후보" 문장을 정정하지 않아, 랜딩 후 인접한 두 Rationale 절이 서로 다른 개수·"다음 후보" 지위를 주장하게 됨 | `plan/in-progress/spec-draft-graph-fk-indexes.md` §변경안 S3 (`spec/1-data-model.md` `## Rationale` 최상단 삽입) | `spec/1-data-model.md` 기존 "삭제 연쇄의 FK 인덱스 다섯" 절 마지막 문단(현재 `spec/1-data-model.md:1008` 부근, "나머지 32개 FK 는 트래커에 전수로 남겼다(지식 베이스 연쇄가 다음 후보)") | S3 서술에 "기존 절의 32개·다음 후보 문구를 28개·해소로 정정한다"는 한 줄을 추가하거나, S3.1 로 그 문장 자체를 취소선/각주 정정. 트래커 쪽 "다음 후보를 «부모 삭제가 드문 큰 테이블 셋»으로 재라벨" 처리와 대칭을 맞출 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | head/tail 비용 재분류가 "삭제 연쇄의 FK 인덱스 다섯" 절의 일반 비용 공식(자식 테이블 크기 × 부모 행 수)의 반례로 오독될 수 있음 — 실측은 "전 테이블 스캔"이 아니라 "복합 인덱스 기존재로 KB 수 비례(skip scan)"이라는 다른 전제 위에 있음 | draft `## 변경안` S3 지시문, `spec/1-data-model.md` `## Rationale` 신설 절 | S3 구현 시 "다섯-절 공식은 선두 인덱스 전무를 전제하고, head/tail 은 복합 인덱스가 이미 있어 그 전제 밖"이라는 한 문장을 다섯-절을 직접 인용해 명시(차단 사유 아님, 방향은 이미 잡혀 있음) |
| 2 | Convention Compliance | S2/S4 예시의 표 행 인용이 단일 백틱 코드 스팬 안에 이스케이프 없는 중첩 백틱을 포함(렌더링 시 스팬이 중간에 끊길 수 있음) | `## 변경안` S2, S4 예시 텍스트 | 조치 불요 — 직전 머지된 `spec-draft-deletion-cascade-indexes.md` 선례와 동일한 관행이며 정식 spec 본문(`spec/1-data-model.md`)에는 전이되지 않음 |
| 3 | Naming Collision | 신설 Rationale 절 제목 "그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)"이 바로 위 기존 절 "삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)"과 같은 날짜·유사 문형이라 목차/grep 만 보는 독자에게 "다섯/넷" 숫자 접미사만으로 구분해야 하는 혼동 여지 | `spec/1-data-model.md` `## Rationale` 신설 절 제목 | 차단 사유 아님 — target 이 이미 관계를 본문에 명시하고 "그래프 RAG" 접두어로 도메인을 구분하고 있어 현재 형태로 충분. 향후 유사 절이 더 늘면 대상 테이블/도메인 명시 관례 유지 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 세 spec 파일(§1-data-model, §5-system/10-graph-rag, data-flow/6-knowledge-base) 삽입 앵커 문자열이 실제 본문과 일치, 실측 주장(기존 인덱스 전부 knowledge_base_id 선두)이 엔티티 코드와 일치, V117~V120·인덱스 이름 넷 전수 grep 0건 |
| Rationale Continuity | NONE | 트래커 예측("재색인 빈도")을 실측("KB 삭제가 가장 무거움")으로 대체·기록하는 패턴이 선례("Trigger" 절)와 동일. head/tail 비용 전제 차이를 더 명시하면 좋겠다는 INFO 1건 |
| Convention Compliance | NONE | migrations.md V번호 단조성·명명·CONCURRENTLY 절차, spec-impl-evidence.md frontmatter/lifecycle 규약 모두 준수. 중첩 백틱 INFO 1건(선례와 동일, 위반 아님) |
| Plan Coherence | LOW | 신설 Rationale 절이 이미 병합된 인접 절의 "32개 남음·지식베이스 연쇄가 다음 후보" 문장을 정정하지 않아 자기모순 남김 (WARNING) |
| Naming Collision | NONE | V117~V120·인덱스 이름 넷·plan 파일명 모두 codebase/spec/plan 전수 grep 0건(자기 자신 제외). Rationale 절 제목 근접 명명 INFO 1건 |

## 권장 조치사항
1. (WARNING 해소) `plan/in-progress/spec-draft-graph-fk-indexes.md` §변경안 S3 에 "기존 '삭제 연쇄의 FK 인덱스 다섯' 절의 '32개 남음(지식 베이스 연쇄가 다음 후보)' 문장을 '28개 남음(다음 후보: 부모 삭제가 드문 큰 테이블 셋)'으로 정정한다"는 지시를 추가해, 구현 시 두 Rationale 절이 서로 모순되지 않도록 한다.
2. (선택, INFO) S3 최종 Rationale 문장에 "다섯-절의 비용 공식은 선두 인덱스 전무를 전제, head/tail 은 복합 인덱스 기존재로 다른 전제(KB 수 비례)"임을 다섯-절을 직접 인용해 한 번 더 명시.
3. (선택, INFO) 나머지 두 INFO(중첩 백틱 표기, Rationale 절 제목 근접 명명)는 선례와 일치하거나 target 이 이미 관계를 명시하고 있어 조치 불요.
