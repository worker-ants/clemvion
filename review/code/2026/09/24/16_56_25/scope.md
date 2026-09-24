# 변경 범위(Scope) 리뷰

## 검토 대상 확정

프롬프트에는 93개 항목이 나열되지만, `git diff origin/main...HEAD --stat`(codebase/, plan/, PROJECT.md 한정)으로 실측하면
실제 코드/문서 diff 는 **8개 파일**로 좁혀진다:

```
PROJECT.md                                             |   2 +-
codebase/backend/jest.config.ts                        |  41 +++--
codebase/backend/package.json                          |  10 +-
.../repo-guards/__tests__/esm-native-load.spec.ts      | 128 ++++++++++++++
codebase/backend/test/jest-e2e.json                    |   4 +-
plan/in-progress/jest-esm-native-load.md               | 187 +++++++++++++++++++++
plan/in-progress/nestjs-v12-coordinated-upgrade.md     |  73 ++++++++
plan/in-progress/spec-draft-nullable-notation-followups.md |  53 ++++++
```

나머지(`review/code/2026/09/24/{14_24_10,15_26_17,16_02_28,16_29_15}/**`,
`review/consistency/2026/09/24/{12_57_36,13_55_20}/**`)는 이번 작업 세션 내 이전 라운드
리뷰/consistency-check 산출물이며, git log 상 `docs(review): N라운드 산출물 + RESOLUTION` 커밋들로
이미 커밋된 상태다. 이 저장소는 리뷰 라운드마다 산출물을 같은 PR 에 함께 커밋하는 것이 표준
워크플로(다수 과거 커밋에서 반복되는 패턴)이므로, 이 디렉터리들 자체는 "요청 밖 추가 변경"이
아니라 **의무화된 프로세스 산출물**이다. 이하 발견사항은 실질 diff 8개 파일에 대해서만 판단한다.

## 발견사항

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 작업 주제(Jest
  ESM 네이티브 로드 / NestJS 12 선행 정리)와 무관한 두 항목이 추가됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 삽입 블록, 원본
    5077번째 줄 뒤 — 항목 제목 `**docs 가드가 검사하는 데이터가 그 가드를 트리거하지 않는다**`
    및 `**CHANGELOG 「해당 없음」 판정에 성문 근거가 없다**`)
  - 상세: 이 plan 문서의 frontmatter/제목은 "nullable 표기 후속 3건"이며 `owner: planner` 로
    스코프가 명시돼 있다. 그런데 추가된 두 항목은 (a) frontend-checks 워크플로 pathspec 이
    `plan/**`·`spec/**` 가드를 안 태우는 문제, (b) CHANGELOG "해당 없음" 판정 기준 부재 — 둘 다
    nullable 표기와도, 이번 PR 의 본 주제(Jest ESM/NestJS 12)와도 직접 관련이 없고, 이번 세션
    자체의 이전 리뷰 라운드(`14_24_10` Critical 1, `15_26_17` W2/INFO 10)에서 발견된 메타적
    관찰을 백로그로 옮긴 것이다. 파일 내부를 보면 이 문서가 이미 수십 개의 이질적 주제(수개월에
    걸친 다양한 spec 경로)를 담은 사실상 범용 developer 백로그로 쓰이고 있어, 이 저장소의
    기존 관행(리뷰 중 발견한 메타 이슈를 그 턴에 plan/ 으로 이월)과 일치하는 것으로 보인다.
    다만 엄밀히는 "이 PR 의 의도된 변경(Jest ESM 대응)" 범위 밖의 내용이 같은 커밋 계열에 섞여
    있다는 점은 사실이다.
  - 제안: 관행상 문제는 아니라고 판단되나, 파일 제목이 좁게 쓰인 채(「nullable 표기 후속」) 범용
    백로그로 계속 쓰이는 drift 는 별도로 정리(제목/역할 명확화 또는 항목별 분리 파일)를 고려할
    가치가 있다. 이번 PR 자체를 막을 사유는 아님.

- **[INFO]** `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 신규 생성 — 실제 NestJS 12
  업그레이드 구현이 아니라 향후 착수 조건을 기록하는 스텁
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (신규 파일 전체)
  - 상세: 이번 PR 의 실제 코드 변경(Jest `transformIgnorePatterns` 원복 + `--experimental-vm-modules`
    적용)이 정확히 이 스텁이 언급하는 "선행 조건"(§B)이며, `git log --follow` 로 확인한 결과 이
    파일은 같은 작업 계열의 앞선 커밋(`d08c8a067` 전후)에서 이미 생성된 것으로, 이번 라운드가
    새로 추가한 범위 확장이 아니다. 문서만 추가했을 뿐 `@nestjs/*` 패키지 자체는 손대지 않아
    "기능 확장/미승인 구현"에 해당하지 않는다.
  - 제안: 없음 (정상 범위).

## 점검 관점별 요약

1. **의도 이상의 변경**: 실질 diff 8개 파일 모두 "Jest 가 ESM 전용 의존성을 네이티브로 로드하게
   하여 `@nestjs/typeorm@12` 의 `import.meta.url` 벽을 넘는다"는 단일 의도에 수렴한다. `package.json`
   전체 diff 를 확인했으나 의존성 버전 변경은 전혀 없고 5개 test 스크립트 문자열만 바뀌었다 —
   제목("deps-nestjs12-ci")과 달리 실제 NestJS 패키지 자체를 올리는 커밋은 아직 없으며, 이는
   plan 문서(§B "선행 조건")가 스스로 명시한 순서와 일치한다.
2. **불필요한 리팩토링**: 없음. `jest.config.ts` 의 주석 재작성은 삭제된 수작업 허용목록을
   대체한 새 로직(`--experimental-vm-modules` 페어링)을 설명하기 위한 것으로, 변경된 동작에
   1:1 대응한다.
3. **기능 확장**: 없음. 새 테스트(`esm-native-load.spec.ts`)는 이번에 바뀐 설정 자체(불변식 붕괴
   방지)만 검증하며, 범위를 벗어나는 추가 기능이나 헬퍼를 신설하지 않았다.
4. **무관한 수정**: 없음. `codebase/` 내에서 건드린 파일은 jest 설정/스크립트/신규 가드 테스트
   뿐이고, 다른 애플리케이션 코드(런타임 로직)는 diff 에 등장하지 않는다.
5. **포맷팅 변경**: `jest.config.ts` 주석 블록이 통째로 재작성됐지만 실질 로직 변경
   (`transformIgnorePatterns` 값 교체)과 섞여 있을 뿐 무의미한 공백/줄바꿈 변경은 아니다.
6. **주석 변경**: 위와 동일 — 모두 실제 동작 변경을 설명하는 목적성 있는 주석이며, 근거 없는
   주석 추가/삭제는 발견되지 않았다.
7. **임포트 변경**: 새 테스트 파일의 `import { v4 as uuidv4 } from 'uuid'` 등은 해당 테스트가
   ESM 전용 패키지를 실제로 로드/호출하는 것이 가드의 본질이므로 필요한 임포트다. 다른 파일에서
   불필요한 임포트 추가/정리는 없다.
8. **설정 변경**: `jest.config.ts`·`test/jest-e2e.json`·`package.json` 스크립트 변경은 모두
   같은 목적(ESM 네이티브 로드)으로 수렴하며 서로 어긋나지 않는다(단위/E2E 양쪽 `transformIgnorePatterns`
   를 동일하게 `['/node_modules/']` 로 맞춘 점도 확인). `PROJECT.md` 정책 문서 갱신은 이 설정
   변경을 정책 SoT 에 반영하는 필수 동반 편집이다.

## 요약

실질 코드/설정 diff(8개 파일)는 "Jest 가 ESM-only 의존성을 네이티브로 로드하도록 하여 막힌
NestJS 12 관련 dependabot PR 들의 진짜 장벽(`import.meta.url`)을 넘는다"는 단일 의도에 정확히
수렴하며, 의존성 버전 자체는 아직 건드리지 않아 제목이 암시할 수 있는 "NestJS 12 업그레이드
구현"보다 스코프가 오히려 보수적이다. 새로 생성된 두 plan 문서 중 하나(`nestjs-v12-coordinated-upgrade.md`)는
이 변경이 unblock 하는 후속 작업의 스텁으로 스코프 내 문서화이고, 다른 하나(기존
`spec-draft-nullable-notation-followups.md` 에 대한 2건 추가)는 파일 제목상 주제와는 어긋나지만
이 저장소가 리뷰 중 발견한 메타 이슈를 그 턴에 plan/ 으로 이월하는 기존 관행과 일치해 보여 차단
사유로 보지 않는다. `review/code/**`, `review/consistency/**` 하위 다수 파일은 이번 세션의
이전 리뷰 라운드 산출물로, 이 프로젝트가 라운드마다 커밋하도록 강제하는 표준 워크플로 결과물이지
범위 이탈이 아니다.

## 위험도

LOW
