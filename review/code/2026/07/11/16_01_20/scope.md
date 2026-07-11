# 변경 범위(Scope) 리뷰

## 대상

- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` (신규)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (리팩터)
- `plan/in-progress/eia-context-schema-followups.md` (체크박스 갱신)

`git diff origin/main --stat` 확인 결과 위 3개 파일이 이번 변경의 전체 집합과 정확히 일치한다(추가 누락 파일 없음).

## 의도 확인

`plan/in-progress/eia-context-schema-followups.md`(리뷰 후속 섹션)에 명시된 선행 항목:

> **`spec-links.ts` 중복 정리** — `findBrokenLinks`(spec/**)와 `findBrokenSpecLinksInSources`(codebase 소스)가 DEAD/ANCHOR 스캔 루프를 ~40줄 골격째 중복 보유했다. ... 공유 코어 `findBrokenLinksInFiles(files, options)` 로 추출 ... 신규 negative-path fixture 단위 테스트(`spec-links.test.ts`) 4건 추가(... ai-review testing WARNING 2건 해소)

세 파일 모두 이 선언된 범위(중복 제거 리팩터 + 회귀 테스트 신설 + plan 상태 동기화) 안에 정확히 대응한다.

## 발견사항

### 파일 1: spec-links.test.ts (신규)
- **[INFO]** 범위 내 신규 테스트 파일
  - 위치: 전체
  - 상세: 새로 추출된 공유 코어 `findBrokenLinksInFiles`의 두 `LinkScanOptions` 분기(`checkSelfAnchors`, `targetFilter`)를 negative-path fixture로 고정한다. plan에 명시된 "ai-review testing WARNING 2건 해소"와 정확히 매핑되며, 리팩터와 분리 불가능한 회귀 안전망이다. `mkLink` 헬퍼로 리터럴 `[text](url)` 패턴을 파일 소스에 남기지 않은 것도 과잉설계가 아니라, 이 파일 자체가 `codebase/frontend/src/**` 아래 있어 `findBrokenSpecLinksInSources`(codebase 소스 가드)의 스캔 대상이 되기 때문에 필요한 최소 방어(안 하면 자기 자신의 fixture 문자열이 가드 위반으로 잡혀 CI가 깨짐).
  - 제안: 없음.

### 파일 2: spec-links.ts (리팩터)
- **[INFO]** 순수 구조 리팩터, 동작 동치성 확인됨
  - 위치: `findBrokenLinksInFiles` 추출부, `findBrokenLinks`/`findBrokenSpecLinksInSources` wrapper화
  - 상세: 기존 두 함수의 스캔 루프(같은-파일 `#anchor` 분기, DEAD/ANCHOR 경로 분기, 캐시 조회 로직)를 `LinkScanOptions`(`checkSelfAnchors`, `targetFilter`) 파라미터화로 병합했다. 각 옵션 조합을 원본 로직과 대조한 결과 동작 동치(`findBrokenLinks`는 `checkSelfAnchors:true`·필터 없음, `findBrokenSpecLinksInSources`는 `checkSelfAnchors:false`·`SPEC_MD_TARGET_RE` 필터로 원래 인라인 조건과 일치). `violations.sort(...)` 최종 정렬도 그대로 유지. 공개 함수 시그니처·반환 타입·소비자 계약 무변경(plan 서술과 일치).
  - JSDoc 갱신(두 함수 상단 주석 + 신규 `LinkScanOptions` 필드 문서)도 리팩터된 구조를 설명하는 목적에 국한되어 무관한 주석 변경 없음.
  - 사소한 참고(스코프 위반 아님, 별도 리뷰어 영역): `findBrokenLinks` 쪽 경로는 원래 `resolved.toLowerCase().endsWith(".md")`로 대소문자 무관 판정했고, `findBrokenSpecLinksInSources` 쪽은 `SPEC_MD_TARGET_RE`(대소문자 구분 `.md$`)로 이미 필터링되어 두 경로가 공유 코어의 `endsWith` 체크와 만나는 지점에서 미세한 케이스-센시티비티 차이가 있으나, 실제 동작 변화는 없다(로직/정확성 문제이지 범위 문제 아님).
  - 제안: 없음.
- **[INFO]** 리팩터에 편승한 무관 수정 없음
  - 상세: import 구문, 포맷팅, 관련 없는 헬퍼(`slugify`, `headingSlugs`, `extractLinks`, `collectSpecMarkdown`, `collectCodebaseSources` 등) 는 손대지 않았다. `slugsFor` 헬퍼 추출은 중복 정리 대상인 캐시 조회 코드(자기-앵커/교차파일 앵커 두 곳에서 동일 패턴 반복)를 하나로 묶은 것으로, "40줄 골격 중복" 정리라는 선언된 목적의 일부다.

### 파일 3: plan/in-progress/eia-context-schema-followups.md
- **[INFO]** 체크박스 동기화, 단일 라인 변경
  - 위치: "## 리뷰 후속" 섹션의 `spec-links.ts` 중복 정리 항목 1줄만 `[ ]` → `[x]` + 완료 근거 텍스트로 교체
  - 상세: `git diff origin/main --stat`로 확인 시 이 파일의 변경은 2줄(diff 1개 hunk)뿐이며, 다른 항목(`swagger.md §1-4`, `EIA 응답 DTO 통합` 등 미완료 항목)은 손대지 않았다. 완료된 작업과 동일 커밋 경계 내 체크박스 갱신은 프로젝트 관례("plan 체크박스 = 실제 상태")에 부합하며 범위 이탈이 아니다.
  - 제안: 없음.

## 요약

세 파일 모두 plan에 선언된 단일 작업 — `spec-links.ts` 의 DEAD/ANCHOR 스캔 중복을 공유 코어(`findBrokenLinksInFiles` + `LinkScanOptions`)로 추출하고, 그 리팩터를 검증하는 negative-path fixture 테스트를 신설하고, plan 체크박스를 완료 상태로 동기화한 것 — 안에 정확히 들어맞는다. `git diff origin/main --stat` 대조로 이 3개 파일 밖의 추가 변경이 없음을 확인했다. 공개 함수 시그니처·반환 계약·정렬 순서가 보존되어 동작 동치를 유지했고, 무관한 포맷팅·주석·임포트·설정 변경은 발견되지 않았다. 신규 테스트 파일의 `mkLink` 우회 설계도 과잉설계가 아니라 이 테스트 파일 자체가 자신이 검증하는 가드의 스캔 대상이 되는 데서 오는 필수적 방어다.

## 위험도

NONE
