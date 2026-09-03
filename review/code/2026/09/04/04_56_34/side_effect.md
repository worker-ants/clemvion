# 부작용(Side Effect) 리뷰

## 스코프 확인

`origin/main...HEAD` diff 는 120개 파일이지만, 실제 코드/문서 변경은 아래 10개뿐이고 나머지
110개는 `review/code/2026/09/04/{01_48_39..04_37_28}/**` 하위의 **과거 리뷰 라운드
산출물**(RESOLUTION.md·SUMMARY.md·meta.json·`_retry_state.json`·각 관점 리포트)이다. 저장소
관례상 정식 산출물 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)이며 읽기 전용
markdown/JSON 텍스트라 부작용 표면이 없다.

실질 코드/문서 변경:
- `codebase/backend/src/common/__test-utils__/source-scan.{ts,spec.ts}`
- `codebase/backend/src/repo-guards/__tests__/{audit-action-binding-guard,engine-error-code-anchor-guard,masked-reject-callers-guard,redis-fail-open-catalog-guard,nullable-type-lie-cast-guard}.ts`
- `codebase/backend/src/repo-guards/__tests__/{masked-reject-callers,nullable-type-lie-cast}.spec.ts`
- `plan/in-progress/entity-nullable-column-type-mismatch.md`

프로덕션 런타임 코드(엔티티 등)는 이번 diff 에 없다 — 이번 changeset 은 테스트 전용
repo-guard 정적 분석 인프라 리팩터링 + 신규 가드 + plan 문서 갱신이다.

이 changeset 은 이전에도 9라운드 리뷰됐다(`01_48_39` ~ `04_37_28`). 직전 라운드
(`04_37_28/side_effect.md`)까지 위험도 **LOW**로 수렴했고, 이후 코드 변경은 커밋
`34ce41086`(9R fix — `nullable-type-lie-cast.spec.ts` 의 `collectTsFiles` 이중 호출을 단일
호출+`filter`로 병합, `plan` 문서 텍스트 갱신) 단 하나다. 아래는 그 신규 커밋을 직접
검증하고, 이전 라운드 결론이 현재 소스에서도 유효한지 `Read`/`grep`으로 재확인한 결과다.

## 신규 커밋(`34ce41086`, 9R) 검토 — fs 순회 1회로 병합

```ts
const all = collectTsFiles(SRC_ROOT, { includeSpec: true });
const entities = all.filter((f) => f.endsWith('.entity.ts'));
const specs = all.filter((f) => f.endsWith('.spec.ts'));
const widened = widenedEntityFields(entities);
```

- **[INFO]** 종전에는 `collectTsFiles(SRC_ROOT)`(스펙 제외)와
  `collectTsFiles(SRC_ROOT, { includeSpec: true })`(스펙 포함)를 각각 호출해 저장소 트리를
  두 번 순회했다. 이번 변경은 후자 하나만 호출하고 `.filter()`로 파생한다 — **fs 접근 횟수를
  줄이는 방향**이라 새 부작용 표면이 생기지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` (`저장수
    전수` describe 블록, `collectTsFiles`/`filter`/`widenedEntityFields` 호출부)
  - 검증: `widened`(Set)는 `findStaleSpecCasts(specs, widened)` 호출에서 `ReadonlySet<string>`
    파라미터로만 소비되며(`.has()` 읽기 전용), describe 스코프의 `const all/entities/specs/widened`
    는 어떤 `it` 블록에서도 재할당·mutate 되지 않는다 — 테스트 간 공유 가변 상태 누수 없음.
    `collectTsFiles`/`widenedEntityFields` 자체는 순수 읽기 함수(파일시스템 읽기만, 쓰기 없음)임을
    `source-scan.ts`/`nullable-type-lie-cast-guard.ts` 원본에서 직접 확인했다.
  - 제안: 조치 불필요.
- plan 문서(`entity-nullable-column-type-mismatch.md`) 변경은 "한 자리만 고치는 버릇" 표에
  7번째 행 추가 + 체크박스 `[ ] → [x]` 전환 + 관련 서술 갱신뿐이며, 코드 실행에 영향을 주는
  부작용이 아니다(정적 문서).

## 이전 라운드 결론 재확인 (직접 소스 대조)

- **공개 함수 시그니처 불변**: `collectSourceFiles`(`audit-action-binding-guard.ts`),
  `listSourceFiles`(`masked-reject-callers-guard.ts`), `collectScanTargets`
  (`nullable-type-lie-cast-guard.ts`), `listProductionSources`
  (`redis-fail-open-catalog-guard.ts`)는 전부 기존 시그니처를 유지한 채 내부 구현만
  `collectTsFiles` 위임으로 교체됐다. `engine-error-code-anchor-guard.ts`는 래퍼 없이
  `collectTsFiles`를 직접 호출(`walkTsFiles` 제거)한다. 이 5개 함수·`stripComments`·
  `countCalls`의 호출부를 저장소 전체(`codebase/backend/src`)에서 `grep`했고, 자기 자신의
  가드/spec 파일 밖에서 참조하는 곳이 없음을 확인했다 — **외부 호출자에 영향 없음**.
- **전역 변수**: 신규/수정 없음. `WIDENED_DECL`/`SPEC_CAST`/`COLUMN_DECL`은 모듈 스코프
  `const` 정규식(`g` 플래그)이지만 전부 `matchAll`로만 소비된다(`matchAll`은 내부적으로
  정규식을 복제하므로 `lastIndex` 상태가 호출 간 누수되지 않는다) — `exec`/`test` 직접
  호출로 인한 고전적 stateful-regex 버그 패턴은 없음.
- **파일시스템**: 프로덕션 소비 경로(`collectScanTargets`/`findCastOffenders`/
  `findUntypedNullableColumns`/`widenedEntityFields`/`findStaleSpecCasts` 등)는 전부
  `fs.readFileSync`만 쓴다(쓰기 없음). 테스트 픽스처(`source-scan.spec.ts`의
  `collectTsFiles` describe, `masked-reject-callers.spec.ts`의 신규 describe,
  `nullable-type-lie-cast.spec.ts`의 `withFiles`)는 전부 `os.tmpdir()`에
  `mkdtempSync`로 격리되고 `beforeEach`/`afterEach` 또는 `try/finally`로
  `fs.rmSync(..., { recursive: true, force: true })` 정리한다 — 저장소 트리를 쓰거나
  지우는 경로 없음. `git status --short`로 현재 작업 트리에 이번 리뷰 세션 출력 디렉터리
  외 잔여물이 없음을 확인했다(뮤테이션 실험을 수행하지 않았으므로 원복 이슈 자체가 없음).
- **환경 변수**: 읽기/쓰기 없음(전 파일 `process.env` 매치 0건, `grep` 확인).
- **네트워크 호출**: 없음(`fetch`/`axios`/`http.` 매치 0건).
- **이벤트/콜백**: 이벤트 발행·구독·콜백 등록/해제 변경 없음 — 이 changeset 은 정적 분석
  가드와 그 테스트일 뿐 EventEmitter/큐/DI 라이프사이클과 무관하다.
- **인터페이스 변경**: `stripComments`가 module-private → `export`로 가시성이 넓어졌다
  (순수 additive, 기존 시그니처·동작 불변, `findStaleSpecCasts`가 재사용하기 위한 근거가
  docstring에 명시돼 있다). `masked-reject-callers-guard.ts`의 `listSourceFiles`가
  `collectTsFiles(rootDir, { includeSpec: true })`로 위임하며 `.d.ts` 배제와 `sort()`를
  새로 상속하는데, `src/` 하위 `.d.ts` 0개(실측)·하위 호출부(`findUnexpectedCallers`)가
  결과를 재정렬함이 이미 이전 라운드에서 확인됐고 이번 라운드에서도 해당 지점은 diff
  없이 그대로다 — 재론하지 않는다.

## 요약

이번 라운드(04_56_34)에서 검토가 필요한 신규 코드 변경은 직전 라운드(`04_37_28`) 이후
추가된 단일 커밋(`34ce41086`, 9R)뿐이며, 그 내용은 이미 순수 읽기 함수인
`collectTsFiles`/`widenedEntityFields` 호출을 1회로 병합하는 리팩터링(fs 접근 감소 방향)과
plan 문서 텍스트 정정이다 — 전역 상태·시그니처·파일시스템·환경 변수·네트워크·이벤트 어느
축에도 새로운 위험을 만들지 않는다. 그 이전에 완료된 walker 통합(`collectTsFiles`)·신규
가드(`widenedEntityFields`/`findStaleSpecCasts`) 도입에 대해서는 공개 함수 시그니처·전역
변수·fs 격리·env·네트워크·이벤트 전 축을 이번 라운드에서 직접 소스를 열어 재확인했고
과거 라운드 결론(부작용 없음)이 여전히 유효함을 확인했다. `review/code/**` 하위 110개
파일은 과거 리뷰 라운드의 읽기 전용 산출물이라 부작용 표면이 없다. Critical/Warning 급
부작용 발견사항 없음.

## 위험도

LOW
