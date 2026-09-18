# Plan 정합성 검토 — `plan/in-progress/spec-draft-graph-fk-indexes.md`

## 발견사항

- **[WARNING]** 새 Rationale 절(S3)이 바로 아래 기존 절의 "32개 남음 · KB 연쇄가 다음 후보" 문장을 그대로 남겨 자기모순을 만든다
  - target 위치: `plan/in-progress/spec-draft-graph-fk-indexes.md` §변경안 S3 (`spec/1-data-model.md` `## Rationale` 맨 위 새 절)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 "선두 인덱스가 없는 FK — … 32개 남음"(트래커 반영 절 참조) · `spec/1-data-model.md` 기존(이미 병합된) `## Rationale` §"삭제 연쇄의 FK 인덱스 다섯" 마지막 문단(현재 `spec/1-data-model.md:1008`): "나머지 32개 FK 는 트래커에 전수로 남겼다(**지식 베이스 연쇄가 다음 후보**)."
  - 상세: draft 는 트래커 파일(plan)의 "32개 남음" → "28개 남음" 갱신은 §"트래커 반영" 에 명시했지만, 같은 사실이 **이미 spec 본문에 박제된 문장**(위 인용, V112~V116 PR 이 남긴 것)은 S1~S5 어디에서도 손대지 않는다. 이 draft 가 랜딩하면 `## Rationale` 최상단에는 "지식 베이스 연쇄 넷을 닫았다"(S3, 새 절)고 적히고, 바로 그 아래 절에는 여전히 "나머지 32개(지식 베이스 연쇄가 다음 후보)"라고 적혀 있어 인접한 두 절이 서로 다른 사실을 주장하게 된다. 개수(32 vs 28)와 "다음 후보" 지위 둘 다 낡는다.
  - 제안: S3 서술에 "기존 절의 32개·다음 후보 문구를 28개·해소로 정정한다"는 한 줄을 더하거나(가장 간단), 별도 S3.1 로 그 문장 자체를 각주/취소선 정정한다. 트래커의 "다음 후보를 «부모 삭제가 드문 큰 테이블 셋» 으로 바꾼다"는 처리와 대칭을 맞추면 된다.

## 요약

target 은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "다음 후보 — 지식 베이스 연쇄" 항목을 문면 그대로(연쇄 표·예측 반증 서술·32→28 카운트·"부모 삭제가 드문 큰 테이블 셋" 재라벨)이어받아 정합하게 닫으며, 마이그레이션 번호(V117~V120)·인덱스 이름 넷 모두 다른 in-progress plan·기존 코드베이스와 grep 0건으로 충돌이 없다. 미해결 결정을 우회하는 지점도, 선행 plan 이 아직 안 끝난 전제도 없다. 유일한 흠은 이 PR 이 닫는 사실이 **이미 병합된 spec Rationale 문장**("32개 남음·KB 연쇄가 다음 후보")과 새로 추가되는 최상단 절 사이에 자기모순을 남긴다는 점으로, S1~S5 체크리스트에 반영되어 있지 않다.

## 위험도
LOW
