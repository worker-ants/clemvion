# Code Review 통합 보고서

## 전체 위험도
**LOW** — `spec-links.ts` 의 `findBrokenLinks`/`findBrokenSpecLinksInSources` 중복 스캔 로직을 `findBrokenLinksInFiles`+`LinkScanOptions` 공유 코어로 통합한 순수 behavior-preserving 리팩터. 7개 reviewer 모두 동작 동치성을 원본 대조·실측(vitest 38/38 또는 13/13 green)으로 확인했고 CRITICAL 은 없다. 다만 `architecture` reviewer 는 `ran` 블록상 `status=success` 로 보고됐음에도 출력 파일(`architecture.md`)이 디스크에 존재하지 않아(disk-write gap) 읽을 수 없었음 — **재시도 필요**. testing reviewer 가 신규 옵션 분기(`checkSelfAnchors:false`)의 브랜치 커버리지 0%와 검출 로직 negative-path 테스트 부재를 WARNING 으로 지적.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 신규 `LinkScanOptions.checkSelfAnchors: false` 스킵 분기(`findBrokenSpecLinksInSources` 가 사용)가 어떤 테스트에서도 실질 실행되지 않음 — 현재 리포의 `.ts`/`.tsx` 소스 코퍼스엔 same-file `#anchor` 링크가 전혀 없어(`.mdx` 문서에만 존재) 브랜치 커버리지 0%. 회귀(부호 반전, 인자 누락 등)를 기존 스위트가 잡지 못함 | `spec-links.ts` (`if (!options.checkSelfAnchors) continue;` 분기), 소비 측 `findBrokenSpecLinksInSources` | fixture 기반(임시 디렉터리 + same-file anchor 포함 가짜 `.ts` 소스) 단위 테스트를 추가해 "same-file anchor 는 무시된다"를 명시적으로 assert |
| 2 | testing | 가드 스위트 전체가 "실 리포에 위반 0건"이라는 positive-only assertion 만 갖고 있어, 검출 로직(DEAD/ANCHOR 를 실제로 잡아내는지)을 증명하는 negative-path fixture 테스트가 없음. 이번 리팩터로 조기 `continue` 분기가 늘어나 vacuous-scan 은폐 리스크가 커짐 | `spec-link-integrity.test.ts:65-68, 88-91` (`expect(violations).toEqual([])`) | 의도적으로 깨진 링크(존재하지 않는 상대경로 1개 + 잘못된 anchor 1개) fixture 를 만들어 `DEAD`/`ANCHOR` 로 정확히 보고되는지 검증하는 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 링크 타깃 경로 해석(`path.resolve`)이 저장소 루트 바깥으로도 해석될 수 있는 형식적 path-traversal 패턴 — 기존 동작 그대로이며, 입력이 이미 커밋된 신뢰 콘텐츠(테스트 전용 CI 유틸)라 실질 악용 경로 없음 | `findBrokenLinksInFiles` 내 `path.resolve(path.dirname(f.absPath), pathPart)` | 조치 불요. 향후 사용자 입력(예: 업로드 markdown) 대상으로 재사용 시에만 `resolved.startsWith(root)` 가드 추가 검토 |
| 2 | performance | `slugCache` 가 여전히 호출당(per-call) 로컬 스코프라, `findBrokenLinks`/`findBrokenSpecLinksInSources` 를 같은 스위트에서 순차 호출하면 겹치는 파일의 heading 파싱이 두 번 발생할 수 있음(기존과 동일, 이번 diff 로 인한 회귀 아님) | `findBrokenLinksInFiles` 내 `const slugCache = new Map(...)` | 이번 PR 스코프 밖. 필요 시 모듈 레벨 캐시로 승격하면 CI 실행 시간 추가 절감 가능 |
| 3 | maintainability | 옵션 플래그(`checkSelfAnchors`, `targetFilter`)와 각 분기의 결합 관계가 함수 본문을 읽어야 파악되고, 통합 후 `findBrokenLinksInFiles` 단일 함수의 순환복잡도가 소폭 증가 | `LinkScanOptions` (365-377행), `findBrokenLinksInFiles` (385-456행) | 현재는 호출부 2개뿐이라 문제 없음. 세 번째 변형 추가 시 named preset 객체 승격 또는 same-file-anchor/path-target 처리를 별도 private 함수로 재분리 고려 |
| 4 | maintainability | private 헬퍼(`findBrokenLinksInFiles`)가 파일 내에서 public API(`findBrokenLinks`)보다 먼저 정의되어 파일을 처음 훑는 독자가 공개 API 파악에 약간의 추가 스캔 필요 | `findBrokenLinksInFiles` (385행) vs `findBrokenLinks` (465행) | 현행 유지 가능. 필요 시 JSDoc 에 두 public 진입점을 명시적으로 링크 |
| 5 | testing | 공유 코어 `findBrokenLinksInFiles` 가 export 되지 않아 옵션 조합을 화이트박스로 직접 단위 테스트할 수 없음(순수 함수라 테스트 용이성 자체는 좋음) | `spec-links.ts:181` (`function findBrokenLinksInFiles(...)`, export 없음) | 필수 아님. 세 번째 호출자(옵션 조합) 필요해지면 export + fixture 단위 테스트 고려 |
| 6 | requirement | 원본 두 함수와의 라인 단위 대조 + 실제 리포지토리 기준 vitest 38/38 green, `tsc --noEmit` 클린으로 동작 등가성 이중 확인. spec-impl-evidence.md §4.2 서술과도 정합 — SPEC-DRIFT 아님 | `spec-links.ts:386-457, 466-470, 528-533` | 조치 불요(정보성 확인) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 형식적 path-traversal 패턴(기존 동작, 실질 위험 없음) 외 특이사항 없음 |
| performance | NONE | 알고리즘 복잡도·I/O 패턴 변화 없음, 순수 dedup |
| architecture | **재시도 필요** | `ran` 블록 `status=success` 이나 `architecture.md` 파일이 디스크에 없음(disk-write gap) — 내용 확인 불가 |
| requirement | NONE | 원본 대조 + 실측(38/38 green)으로 동작-불변 리팩터 확인, SPEC-DRIFT 아님 |
| scope | NONE | 단일 파일 국한, 요청 이상의 기능/포맷팅/무관 파일 변경 없음 |
| side_effect | NONE | 동작 동치성 확인, `slugCache` 여전히 함수-로컬, 신규 export/fs/env/network 부작용 없음 |
| maintainability | LOW | 옵션-분기 결합도·순환복잡도 소폭 증가는 있으나 실질 가독성 저하는 낮음 |
| testing | LOW | 신규 옵션 분기 커버리지 0%, negative-path fixture 부재(WARNING 2건) |

## 발견 없는 에이전트

- security, performance, requirement, scope, side_effect — 실질적 문제 없음(순수 리팩터 동치성 확인, 범위 이탈 없음)

## 권장 조치사항

1. **architecture reviewer 재실행** — `status=success` 보고와 달리 `architecture.md` 출력 파일이 존재하지 않아 내용을 검증하지 못했다. 이 파일을 읽지 못한 채로는 통합 위험도 판정이 불완전하므로, 재시도 후 본 SUMMARY 를 갱신할 것.
2. (testing WARNING #1) `checkSelfAnchors: false` 분기를 실제로 exercise 하는 fixture 기반 단위 테스트 추가.
3. (testing WARNING #2) DEAD/ANCHOR 검출 로직 자체를 증명하는 negative-path(의도적으로 깨진 링크) fixture 테스트 추가 — 향후 vacuous-scan 회귀를 조기에 잡기 위함.
4. (INFO, 선택) 세 번째 스캔 변형이 필요해지는 시점에 `findBrokenLinksInFiles` export + named preset 옵션 객체로 승격 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing` (8명)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (소스 코드 변경 시 항상 적용 — `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`). `performance`, `architecture` 는 router 자체 판단으로 추가 선택됨.
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | documentation | 사용자 대상 문서 변경 없음(테스트 전용 내부 유틸리티 리팩터) |
  | dependency | 패키지/의존성 변경 없음 |
  | database | DB 스키마·쿼리 관련 코드 변경 아님 |
  | concurrency | 동시성/비동기 상태 관리 코드 변경 아님 |
  | api_contract | API 계약/DTO 변경 없음 |
  | user_guide_sync | 사용자 가이드 동기화 대상 변경 아님 |