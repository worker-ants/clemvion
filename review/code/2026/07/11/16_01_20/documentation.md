# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 리팩터로 두 스캔 모드가 완전히 통합됐는데 파일 상단 헤더 코멘트는 아직 `spec/**` 전용 서술만 유지
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:447-458` (diff 밖, 미변경 컨텍스트)
  - 상세: 파일 최상단 코멘트는 "Shared helpers for the spec-link-integrity guard. Validates in-repo markdown links in `spec/**` narrative docs" 로만 기술한다. 이 서술 자체는 이번 diff 이전(#912)부터 이미 stale 했던 것이라 이번 변경이 새로 유발한 문제는 아니지만, 이번 리팩터가 `findBrokenLinksInFiles` 공유 코어로 두 스캔 모드(spec narrative vs codebase source)를 한 함수에 명시적으로 통합하면서 그 경계가 더 뚜렷해졌다. 헤더가 codebase-source 스캔(§"Codebase-source spec links" 섹션, `findBrokenSpecLinksInSources`)을 언급하지 않아 파일을 처음 읽는 사람이 스캔 범위를 오해할 수 있다.
  - 제안: 필수는 아니나, 후속 편집 시 헤더에 "spec/** 내부 링크 + codebase 소스의 spec 참조 링크 둘 다 검증" 한 줄을 추가하면 module-level 문서가 현재 구조를 정확히 반영한다.

## 점검한 항목 (문제 없음)

- **JSDoc/독스트링**: 신설 `LinkScanOptions` 인터페이스의 두 필드(`checkSelfAnchors`, `targetFilter`) 모두 필드 단위 JSDoc 을 갖추고 있고, "왜" 이 옵션이 필요한지(spec 문서는 자기 heading 참조, code 소스는 heading 이 없음)까지 설명한다. 비공개(미-export) 함수인 `findBrokenLinksInFiles` 에도 JSDoc 을 유지했고 "두 public 진입점은 파일 집합과 옵션 2개만 다르다" 는 설명이 실제 구현과 정확히 일치한다. 공개 함수 `findBrokenLinks`/`findBrokenSpecLinksInSources` 의 JSDoc 도 동작 변경(same-file 앵커 스킵 사유 등)에 맞춰 갱신되어 코드와 어긋나지 않는다.
- **주석 정확성**: 새 테스트 파일(`spec-links.test.ts`)의 파일 헤더 코멘트가 이 fixture 테스트의 존재 이유(실 레포 가드는 positive-only 라 vacuous pass 를 배제 못함), `LinkScanOptions` 두 노브를 어떤 진입점이 어떤 값으로 고정하는지, 그리고 `mkLink` 헬퍼가 왜 필요한지(리터럴 마크다운 링크가 파일 안에 있으면 `findBrokenSpecLinksInSources` 가 이 fixture 자체를 스캔해 오탐할 수 있다는 미묘한 self-poisoning 회피)까지 정확하고 상세하게 서술한다. 인라인 주석(`// valid self-anchor → no violation` 등)도 각 fixture 라인의 기대 결과와 정확히 대응한다.
- **README/API 문서**: 순수 내부 dev-tooling(spec-link-integrity 가드) 리팩터로 사용자 대면 기능·API 엔드포인트 변경이 없어 README·API 문서 갱신 대상이 아니다.
- **CHANGELOG**: `CHANGELOG.md` 는 spec 에 연결된 제품 동작 변경만 기록하는 패턴이며, 동일 plan 의 선행 항목들(harness 타입체크 배선, spec-link CI trigger 확대 등 다른 내부 dev-tooling 변경)도 CHANGELOG 에 없다. 이번 순수 리팩터(공개 시그니처·런타임 동작 무변경)도 그 전례와 일관되게 CHANGELOG 대상이 아니다.
- **설정 문서**: 신규 환경변수·설정 옵션 없음.
- **예제 코드**: `LinkScanOptions` 의 두 실사용 예(`checkSelfAnchors: true` / `checkSelfAnchors: false + targetFilter`)가 바로 아래 두 공개 함수 구현 자체로 이미 예시 역할을 하며, 신규 fixture 테스트가 각 옵션 조합의 관찰 가능한 동작을 추가로 실증한다.
- **plan 문서**: `plan/in-progress/eia-context-schema-followups.md` 항목이 `[ ]` → `[x]` 로 갱신되며 실제 구현 내용(공유 코어 추출, 옵션 2종, 시그니처/소비자 계약 무변경, 4건 fixture 테스트 추가, PASS 한 테스트 스위트 수)을 정확히 반영한다. `spec-impl-evidence.md §4.2` SoT 표(파일 존재 여부만 참조)와 `spec-link-integrity.test.ts` 의 실제 import 표면(`collectCodebaseSources`/`collectSpecMarkdown`/`findBrokenLinks`/`findBrokenSpecLinksInSources`)도 이번 리팩터 이후에도 일치를 유지한다.

## 요약

내부 dev-tooling(spec-link-integrity 가드) 코드 중복 제거 리팩터로, 공유 코어로 옮긴 로직에 필드별 JSDoc 을 갖춘 신설 옵션 인터페이스와 갱신된 공개 함수 독스트링이 실제 동작과 정확히 일치하며, 신규 negative-path fixture 테스트 파일의 헤더·인라인 주석이 테스트 의도와 미묘한 설계 결정(self-poisoning 회피)까지 모범적으로 설명한다. README/API/CHANGELOG/설정 문서는 이 변경의 성격(공개 시그니처·런타임 동작 무변경, 순수 내부 리팩터)상 갱신 대상이 아니며 실제로 손대지 않은 것이 이 레포의 전례와 일관된다. 유일하게 지적할 점은 파일 최상단 모듈 헤더 코멘트가 diff 이전부터 이미 codebase-source 스캔 범위를 언급하지 않고 있었다는 것으로, 이번 리팩터가 유발한 결함은 아니고 차단 사유도 아니다.

## 위험도
NONE
