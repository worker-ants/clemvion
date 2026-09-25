# Rationale 연속성 검토 — `plan/in-progress/lockfile-libc-pin.md`

## 발견사항

없음 (CRITICAL/WARNING 없음).

- **[INFO]** spec Rationale 적용 대상 아님 — 범위 확인만 기록
  - target 위치: `plan/in-progress/lockfile-libc-pin.md` frontmatter (`spec_impact: none`) 전체
  - 과거 결정 출처: 해당 없음 — 번들된 전 spec (`spec/0-overview.md`, `spec/1-data-model.md` 외 전 영역)의
    `## Rationale` 을 전수 확인했으나, pnpm 버전 핀·lockfile 직렬화·dependabot·`libc:` 메타데이터·CI 툴체인에
    관한 항목은 어느 spec Rationale 에도 존재하지 않는다 (grep 결과 0건, 대상 문서 자신을 제외하면).
  - 상세: target 은 `package.json` 의 `packageManager` 핀과 `Dockerfile.playwright-e2e` 의 corepack 폴백만
    바꾸는 순수 빌드/의존성 관리 결정이며, 제품 도메인(테넌시·S3 키·DB 마이그레이션·실행 엔진·웹훅 유일성 등)
    어느 Rationale 이 세운 원칙과도 접점이 없다. `spec_impact: none` 이 실제로 성립한다.
  - 제안: 조치 불요. spec Rationale 관점에서는 통과.
- **[INFO]** 유일하게 관측되는 "결정 번복" 은 spec 이 아니라 자매 plan(`deps-guard-hardening.md`) 소관이며, 이미 새 근거를 동반한다
  - target 위치: `plan/in-progress/lockfile-libc-pin.md` §B "가드를 새로 세우지 않는 이유" (라인 97~101)
  - 과거 결정 출처: `plan/in-progress/deps-guard-hardening.md` §«후속 — lockfile `libc:` 필드가 커밋마다
    진동한다» 의 체크박스 "(b) 채택 시 동반: lockfile `libc:` 개수 회귀 가드"(2026-08-09 등재) — **plan 문서이지
    spec `## Rationale` 이 아니므로 본 checker 의 핵심 관점(1~4) 대상은 아니다.**
  - 상세: target 은 그 "개수 가드" 안을 "base·head 둘 다 있는 `name@version` 엔트리의 `os`·`cpu`·`libc` 동일성"
    설계로 대체한다. 번복이지만 (a) 번복 사유 두 가지(핀 통합으로 진동 원인 소멸, 개수 지표는 의존성 삭제 시
    오탐)를 그 자리에 명시했고, (b) 새 설계를 "그 절에 적고" `deps-guard-hardening.md` 체크박스를 갱신하겠다고
    §C 검증 체크리스트에 이미 반영했다 — 결정 번복 시 새 rationale 을 동반해야 한다는 원칙(관점 3)을 spec 밖
    문서에서도 자발적으로 satisfy 하고 있다.
  - 제안: 조치 불요. spec Rationale 범위 밖이라 등급 부여 대상은 아니지만, §C 체크리스트의 "`deps-guard-hardening.md`
    두 체크박스 갱신" 항목을 실제 실행할 때 위 "정확한 불변식" 문구를 그 plan 파일에 축약 없이 그대로 옮길 것을
    권장한다(번복 근거가 옮겨적는 과정에서 유실되지 않도록).

## 요약
target 은 pnpm 버전 핀 상향과 CI 툴체인 수정만 다루는 `spec_impact: none` 순수 인프라 plan이며, 번들된 전체 spec
Rationale(제품 도메인 결정 전수)을 대조한 결과 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant
우회 어느 것도 발견되지 않았다. 유일한 "결정 번복"으로 보이는 지점(lockfile `libc:` 개수 가드 → 엔트리별
os/cpu/libc 동일성 설계로 교체)은 spec Rationale 이 아니라 자매 plan 문서(`deps-guard-hardening.md`) 소관이라
본 checker 의 핵심 스코프 밖이지만, target 스스로 번복 사유와 대체 설계를 명시적으로 적어 rationale 연속성
원칙을 이미 충족하고 있다.

## 위험도
NONE
