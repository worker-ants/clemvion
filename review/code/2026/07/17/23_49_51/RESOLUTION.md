# Resolution — review/code/2026/07/17/23_49_51

> 대상: `00b3b05a4` (Phase 2·3, main `29aa918a6` 위) + 본 커밋(리뷰 fix).
> 리뷰 전체 위험도 **LOW**, Critical **0**, Warning **2**. 수동 흐름 처리.

## 조치 항목

| 출처 | 항목 | 조치 |
|---|---|---|
| WARNING #1 (testing) | 메시지 생성 로직(`STATIC_IMPORT_MSG`/`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`, `LAYERS_LABEL`, `RESOLUTION_HINT`)의 `.message` 내용을 어떤 테스트도 검증하지 않음 — 변수 뒤바뀜·라벨 누락이 나도 통과 | **FIXED** — 콘텐츠 스위트에 "위반 메시지가 실제 계층 라벨과 규약 링크를 담는다" 케이스 추가. 정적/동적/require 세 진입점 각각 `.message` 가 `LAYERS_LABEL`(`src/lib/** · src/types/**`)·spec 링크·형태별 문구를 담는지 `toContain` 으로 고정. 재현 검증(mutation 3종 전부 1건 실패): ① `LAYERS_LABEL` join 변조, ② require↔dynamic 메시지 뒤바꿈(WARNING#1 원 시나리오), ③ spec 링크 제거 |
| WARNING #2 (documentation) | fail-open 에러 메시지가 옛 `files: ["src/lib/**"]` 리터럴을 인용 — config 는 이제 `LOWER_LAYERS` 로 확장됐는데 텍스트가 현재 구성을 오기 | **FIXED** — 메시지를 `JSON.stringify(CONFIG_LOWER_LAYERS)` 파생으로 변경. 겸사겸사 블록 탐색 키도 하드코딩 `"src/lib/**"` → `CONFIG_LOWER_LAYERS[0]` 파생으로 바꿔, config glob 표기가 바뀔 때 조용히 어긋나던 결합을 제거 |
| INFO #11 (testing) | 스코프 스위트에 근접 오탐(near-miss) 경계 케이스 부재 | **반영** — `src/types-legacy/`·`src/libs/` 를 "차단되지 않아야 한다" 케이스로 추가 (glob 이 앵커 없이 느슨해지는 회귀 탐지) |
| INFO #12 (testing) | `src/lib/types/` vs `src/types/` 혼동 지점 회귀 고정 없음 | **반영** — `src/lib/types/probe.ts` 가 `src/lib/**` 계층으로 차단됨을 고정하는 케이스 추가. 규약 §1 이 명시적으로 구분하는 두 "types 홈" 이 둘 다 차단되되 근거 glob 이 다름을 문서화 |
| INFO #13 (documentation) | §4/§4.1 의 PR 번호 각주 보존 정책 불일치 | **조치 불필요로 판정** — §4 에 PR #969("백틱 우회를 어떻게 닫았나")가 역사적 근거로 1회 남고 §4.1(테스트가 고정하는 것)엔 없는 것이 정합적이다. 리뷰어가 본 불일치는 승격 편집 중간 상태 — 최종본은 일관됨 |
| INFO #1·2·3·4·5·6·7·8·9·10·14·15 | 계층별 메시지 미분리(동일 제약이라 타당)·config↔test 결합(의도된 SoT 단일화)·규칙 선형증식(spec Rationale 에 유예 명시)·조사 표기·규약 vs 가드 간극(spec 이 명시한 설계)·리팩터 스코프·plan 이동 규모·rule-id predicate 중복·리터럴 중복(false-green 방지 의도)·보안 무관·lint 정책 확장 | **조치 불필요** — 전부 이미 근거가 문서화된 의도된 트레이드오프이거나 무관 |

## TEST 결과

- **lint**: 통과
- **unit**: 통과 — 레이어 가드 스위트 51 케이스(47→48 문구 검증 +1, 이후 근접/lib-types +3 = 51). frontend 전체는 아래 재수행에서 확인
- **build**: 통과 (fix 후 재수행)
- **e2e**: 통과 (fix 후 재수행) — backend jest 256 + playwright. 면제 불가(변경 set 에 `eslint.config.mjs`(빌드 설정)·`*.test.ts` 포함)

## 보류·후속 항목

없음. INFO 는 반영 또는 근거 있는 미조치로 종결.
