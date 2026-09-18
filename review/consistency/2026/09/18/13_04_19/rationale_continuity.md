# Rationale 연속성 검토 — `plan/in-progress/spec-draft-trigger-workflow-index.md`

## 발견사항

- **[INFO]** S4(migrations.md §5 콜아웃 일반화)의 1라운드 처분 번복은 근거를 갖추고 있으나, 그 근거가 영구 문서(spec)가 아니라 plan 문서에만 남는다
  - target 위치: `## 변경안` → `### S4` 의 "**1라운드 처분을 뒤집는다**" 단락, `## 체크리스트`의 `/ai-review` 항목
  - 과거 결정 출처: `review/code/2026/09/18/12_43_23/RESOLUTION.md` WARNING 1 처분 — "`spec/conventions/migrations.md` §5 의 «인덱스 교체는 별도 패턴이 있다» 는 교체에 한정된 문장이라 지금도 참이고, … spec 은 고치지 않는다"
  - 상세: draft 는 1라운드 처분을 뒤집으면서 **구체적 반박 근거**를 제시한다 — (a) "«교체는 README 를 따른다» 는 곧 «신규 추가는 따르지 않아도 된다» 로 읽힌다"는 오독 위험, (b) 1라운드가 근거로 든 "§5 3단계가 README §4·§5 를 가리킨다"는 실제로는 `.conf` 사용 맥락(§4)·"executeInTransaction=false 파일은 한 statement 만"(§5 원 규칙)에 대한 참조이지 DROP-먼저 invalid 잔재 정리 패턴을 가리키는 게 아니라는 반박. 이는 임의의 번복이 아니라 1라운드 근거의 특정 지점을 짚어 무효화한 것으로, criterion 3("결정의 무근거 번복")에 해당하지 않는다. 다만 이 반박·재판정의 서술은 `plan/in-progress/spec-draft-trigger-workflow-index.md`(추후 `plan/complete/`로 이동)에만 있고, `spec/conventions/migrations.md` 자체의 `## 7. 폐기 대안 (Rationale)` 절에는 이 절차 문구가 왜 "교체 전용"에서 "CONCURRENTLY 인덱스 생성 전체"로 넓어졌는지에 대한 흔적이 남지 않는다. `spec/1-data-model.md` 의 이번 신설 Rationale 절("Trigger (workflow_id) 인덱스")은 `plan/complete/spec-draft-trigger-workflow-index.md` 를 출처로 명시해 추적 경로를 열어 두는데, migrations.md 쪽은 그 출처 포인터조차 없다.
  - 제안: 필수는 아니나(README 가 이미 상세 근거·V056/V106 대조표를 SoT 로 보유하고, `migrations.md` Overview 가 "실제 작성 가이드는 README 담당"이라 명시한 기존 위임 구조와 정합함), `spec/conventions/migrations.md` §5 콜아웃 변경분 끝에 "적용 범위를 CONCURRENTLY 인덱스 생성 전체로 넓힌 이유는 README §5 참고(2026-09-18)" 정도의 1줄 포인터를 추가하면 이후 `--spec` 리뷰가 RESOLUTION.md 이력을 다시 파지 않고도 번복 근거에 닿을 수 있다.

- **[INFO]** S4 변경 범위가 `CONCURRENTLY` 사용 파일로 좁게 유지된 것은 과잉 일반화를 피한 적절한 스코핑
  - target 위치: `### S4` "`CONCURRENTLY` 로 한정하는 이유" 단락
  - 과거 결정 출처: 해당 없음(신규 스코핑 판단)
  - 상세: 콜아웃을 "인덱스를 만드는 마이그레이션 전부"가 아니라 "`CREATE INDEX CONCURRENTLY` 를 쓰는 파일"로 한정하고, 그 경계를 트랜잭션 내 `CREATE INDEX`는 실패 시 통째로 롤백돼 invalid 잔재가 남지 않는다는 사실로 근거 지었다. README §5 의 기존 서술과 정확히 정합하며, 불필요하게 넓은 규칙(모든 마이그레이션)으로 번지지 않았다. 위반 아님 — 참고로 기록.

## 다른 변경분(S1~S3) 재확인

S1~S3 은 직전 회차(`review/consistency/2026/09/18/12_18_52`, BLOCK: NO)에서 이미 검토돼 spec 에 반영됐고, 이번 회차에서 다시 훑어도 새로운 Rationale 충돌은 없다.

- `spec/1-data-model.md` 신설 Rationale "Trigger `(workflow_id)` 인덱스 (2026-09-18)" 는 같은 문서의 "Schedule 인덱스 … (2026-09-04)" 절이 확립한 원칙("선두는 술어 컬럼이어야 한다")을 그대로 인용·확장하고 있어(§ "단독 컬럼인 이유") 원칙 위반이 없다.
- "같은 클래스 전수 — 나머지 여섯은 이 결정에 넣지 않았다" 서술은 트래커에 그대로 옮겨져(§ "트래커 반영") 버려지는 정보가 없다 — 과거 유사 사례(Schedule 인덱스 절의 "기각한 대안" 서술 패턴)와 형식이 일관된다.
- Rationale 절 삽입 위치(새 절을 "맨 위, 최근 순"에 둔 것)는 해당 문서의 기존 절 순서(2026-09-06 → 2026-09-04 → 2026-08-31 …) 관례와 일치한다.
- `install_token`·`WorkflowVersion.snapshot`·`User select:false` 등 이 번들에 실린 다른 Rationale 항목은 이번 draft 의 어떤 변경과도 접점이 없어 충돌 후보가 아니다.

## 요약

이번 회차의 초점인 S4(`spec/conventions/migrations.md` §5 콜아웃을 "교체 전용"에서 "`CREATE INDEX CONCURRENTLY` 를 쓰는 모든 파일"로 일반화)는 1라운드 RESOLUTION 의 "spec 은 고치지 않는다" 처분을 뒤집지만, 그 번복은 1라운드 근거의 구체적 결함(§5 3단계 참조는 `.conf` 맥락일 뿐 DROP-먼저 패턴을 가리키지 않는다)을 짚은 실질적 재반박에 근거하고 있어 "무근거 번복"에 해당하지 않는다. 다만 그 반박·재판정 서술이 spec 자체가 아니라 plan 문서에만 남아, `spec/conventions/migrations.md` 만 읽는 향후 독자는 이 절차 문구가 왜 넓어졌는지 추적할 진입점이 없다 — 필수 차단 사유는 아니며 1줄 포인터 보강을 제안한다. S1~S3 은 기존 Rationale 원칙(선두 술어 컬럼 등)과 정합하고 정보 손실 없이 트래커에 이관돼 문제가 없다.

## 위험도
LOW
