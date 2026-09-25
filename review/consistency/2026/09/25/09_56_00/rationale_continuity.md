# Rationale 연속성 검토 — `plan/in-progress/harness-probe-isolation.md`

## 발견사항

없음. 아래는 확인한 근거다.

- **번들 스코프 자체가 대상 밖이다.** 첨부된 `## Rationale 발췌` 는 `spec/` 전 영역(70여개 문서, `0-overview` ·
  `1-data-model` · `2-navigation/*` · `5-system/*` · `data-flow/*` 등)을 사실상 전수로 실었고, 대부분은 예산
  초과로 절단됐다(`⚠️ 본문 생략됨 — 컨텍스트 예산 초과` 표시 다수). 그런데 target 은 `spec_impact: none` 인
  harness-only 버그 수정 plan — pytest 하네스가 실제 저장소 트리(spec 파일 · plan 파일)에 프로브를 쓰는 경합을
  임시 git 사본 + 루트 주입으로 없애는 것이 전부다. 실려 있는 Rationale 항목들(S3 키 prefix 설계, Flyway 채택,
  실행 엔진 큐 설계, webhook `endpoint_path` 전역 유일, 트리거 목록 API 경로 결정 등)은 **제품 도메인 결정**이고
  target 이 다루는 **테스트 하네스 격리** 와 주제가 겹치지 않는다. 따라서 target 이 이 Rationale 들 중 어느 것도
  재도입·번복·우회하지 않는다.
- **`spec/5-system/7-llm-client.md` 는 프로브 "피해자" 로만 등장한다.** target 은 이 문서를 테스트가 실수로
  건드리는 실제 spec 파일의 예시로 인용할 뿐(§A 표 1행, "**`7-llm-client.md` 는 실제 spec 이다**"), 그 문서의
  Rationale 이 정한 어떤 설계 결정(`embed` 위치 인자, `RerankClient` 분리, SSRF 가드 재사용 등)도 다루거나
  바꾸지 않는다. 이 파일이 번들에 포함된 것은 target 텍스트에 그 파일명이 언급돼 키워드 매칭된 것으로 보이며,
  내용상 충돌 지점은 없다.
- **target 자체가 "기각한 대안"을 실측 근거와 함께 명시한다.** §C 는 트래커(`spec-draft-nullable-notation-followups.md`)
  가 제시한 두 처방 후보 중 하나("프로세스별 고유 파일명 + 바이트 복원")를 기각하고 다른 하나("임시 디렉터리의
  저장소 사본 + 루트 주입")를 채택하면서, 기각 이유(추적 파일 편집을 못 닫는다)를 §A/§B 의 실측(전수 census ·
  재현 라운드)에 근거해 적었다. 이는 "결정의 무근거 번복" 에 해당하지 않는다 — 오히려 이 저장소가 이미
  `spec/1-data-model.md` Rationale(예: "쓸 인덱스가 없는 FK 서른하나의 처분", "Schedule 인덱스" 절)에서 쓰는
  "기각한 대안 — 이유" 서술 패턴과 형식적으로 합치한다.
- **`spec/` 을 건드리지 않는다는 스스로의 전제가 일관적이다.** frontmatter `spec_impact: none` 과 체크리스트
  1항("spec 영역이 없는 harness-only 변경이라 `--impl-prep` 이 성립하지 않는다")은 `CLAUDE.md` 의
  "harness 변경은 리뷰 게이트가 물지 않는다 … 검증은 `python3 -m pytest .claude/tests -q`" 조항과 정합한다.
  이는 spec Rationale 이 아니라 거버넌스 문서지만, 참고 삼아 확인한 결과 target 이 이 예외 규약을 위반하거나
  임의로 넓히지 않았다(그대로 하네스 테스트로만 검증을 예정).
- **새로 도입하는 `_harness.make_probe_repo` 헬퍼는 기존 spec Rationale 이 정의한 어떤 시스템 invariant 도
  우회하지 않는다.** 대상은 테스트 하네스 코드(`_harness.py`, `test_*.py`)뿐이며, 임시 저장소는 `origin/main ==
  HEAD` 로 만들어 실제 브랜치·커밋 이력과 분리된 사본이라고 명시한다(§C "판별력이 약해지지 않는가"). 이는
  `spec/1-data-model.md` 의 마이그레이션 · 웹훅 등 운영 데이터 invariant 와 무관한 별도 스코프다.

## 요약
target 은 spec 영역을 건드리지 않는 harness-only 테스트 격리 버그 수정 plan 이며, 첨부된 Rationale 번들은
주제상 무관한 제품 도메인 결정(전 spec 전수, 대부분 예산 절단)으로 구성돼 있어 실제 충돌 지점이 없다.
target 이 인용하는 유일한 실제 spec 파일(`7-llm-client.md`)은 프로브의 피해 대상으로만 등장하고 그 문서의
설계 결정을 다루지 않는다. target 자신의 "기각한 대안" 서술은 실측(전수 census · 병렬 재현)에 근거해
작성돼 있어 이 저장소의 기존 Rationale 서술 관행과 형식적으로 합치하며, 무근거 번복이나 합의 원칙 위반으로
볼 근거가 없다.

## 위험도
NONE
