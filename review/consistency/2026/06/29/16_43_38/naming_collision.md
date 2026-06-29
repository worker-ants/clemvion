# 신규 식별자 충돌 검토 결과

## 검토 대상

- target 문서: `spec/conventions/i18n-userguide.md`
- 브랜치 변경 파일 4건:
  - `spec/conventions/i18n-userguide.md`
  - `spec/2-navigation/13-user-guide.md`
  - `spec/conventions/user-guide-evidence.md`
  - `spec/conventions/spec-impl-evidence.md`

## 전제 확인

`spec/conventions/i18n-userguide.md` 는 **신규 파일이 아니라 기존 파일의 수정**이다 (git 이력상 commit `493121836` 이후 존재, 본 브랜치는 Principle 7 설명 1줄 갱신 + 자동 가드 표 1줄 갱신). 나머지 3파일도 모두 기존 파일에 대한 설명 문구 추가/수정이다.

## 발견사항

### [INFO] `Principle N` 번호 체계가 문서 간 독립적으로 쓰임 — 기존 양상 유지, 신규 충돌 없음

- target 신규 식별자: 이번 diff 에서 새로 도입된 Principle 번호는 없음. 기존 Principle 1–7 서술 내 1줄 문구 변경만 존재.
- 기존 사용처: `spec/conventions/node-output.md` 가 독립적인 "Principle 0–11" 번호 체계를 가짐. 두 파일의 `Principle 7` 은 각자 다른 의미 (i18n-userguide = "페이지 stale 방지", node-output = "`config` echo 원칙") 다.
- 상세: 이 번호 중복은 이번 변경 이전부터 존재했으며, 두 문서는 cross-reference 시 항상 파일명을 명시 (`CONVENTIONS Principle 7`, `[i18n-userguide.md §Principle 7]`, `[node-output.md Principle 7 D1]`) 한다. 이번 diff 는 이 구조를 변경하지 않는다.
- 제안: 현 상태 유지 가능. 향후 규약 문서 신규 추가 시 `Principle N` 번호를 다른 파일에 추가하는 경우, cross-reference 에 파일명 한정자를 반드시 포함시키는 기존 관행을 계속 준수하면 된다.

### [INFO] `findGuiFlowSections()` 판별 정의 설명이 두 문서에 병렬 서술됨

- target 신규 식별자: `i18n-userguide.md §Principle 7` 에 `findGuiFlowSections()` 의 "두 신호 OR" 판별 기준 설명이 추가됨.
- 기존 사용처: `spec/conventions/user-guide-evidence.md §2` 가 SoT 로 동일 판별 기준을 이미 정의함. 이번 `i18n-userguide.md` 변경은 "`판별 정의 SoT 는 user-guide-evidence.md §2`" 라고 명시해 이중 SoT 발생을 피함.
- 상세: 충돌 아님. `i18n-userguide.md` 는 SoT 위임을 명시하고 요약만 서술하는 패턴으로 처리돼 있다.
- 제안: 현재 구조 적절. 변경 불필요.

### [INFO] `spec-impl-evidence.md` 에 추가된 테스트 파일명 3건은 기존 명칭과 동일

- target 신규 식별자: `impl-anchor-existence.test.ts` / `integrations-coverage.test.ts` / `triggers-coverage.test.ts` 를 `spec-impl-evidence.md` Rationale 절에 신규 언급.
- 기존 사용처: 동일 이름이 `spec/conventions/user-guide-evidence.md` 및 `spec/2-navigation/13-user-guide.md` 에 이미 등재.
- 상세: 동일 의미로 동일 파일을 가리키는 일관된 사용이며 충돌 없음.
- 제안: 현재 상태 유지.

## 요약

이번 브랜치가 변경한 4개 spec 파일은 모두 기존 파일의 내용 보완(설명 정밀화·가드 표 갱신·Rationale 문단 추가)이다. 신규로 도입된 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수·설정키, 파일 경로가 없다. `Principle N` 번호 중복은 이번 변경 이전부터 문서 간 독립 체계로 운용되어 왔으며, cross-reference 마다 파일명 한정자를 붙이는 기존 관행이 유지되고 있어 실질 충돌이 없다. 신규 식별자 충돌 관점에서 차단 사유가 없다.

## 위험도

NONE
