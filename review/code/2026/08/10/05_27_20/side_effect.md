# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `makeSpecExists` 의 `spec/` 접두사 검사가 `..` 경로 순회(path traversal)를 막지 못해 저장소 루트 밖 임의 파일을 대상으로 `statSync` 를 수행할 수 있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:117` (`if (!p.startsWith("spec/")) return false;`), `:122` (`fs.statSync(path.join(root, p)).isFile()`)
  - 상세: 이번 커밋은 "존재하는 것이면 뭐든 통과" 하던 구멍(`CLAUDE.md`, `codebase/frontend/package.json` 등)을 `spec/` 접두사 검사로 닫았다. 그런데 문자열 접두사 검사(`startsWith`)만 하고 `path.join` 이후 정규화를 재검증하지 않기 때문에, `spec_impact: ["spec/../../../etc/hostname"]` 처럼 `spec/` 로 시작하되 내부에 `..` 를 포함한 값은 그대로 통과해 `path.join(root, p)` 이 저장소 루트 밖(`/etc/hostname` 등)으로 정규화된다. 직접 확인:
    ```
    path.join(root, "spec/../../../../../../etc/hostname")
    → "/Volumes/project/etc/hostname"
    "spec/../../../../../../etc/hostname".startsWith("spec/") === true
    ```
    실제 위협 모델(저장소에 이미 `plan/complete/**` 를 커밋할 권한이 있는 행위자)에서 파급력은 제한적이지만(불리언 pass/fail 만 영향, 내용 유출 없음), 이 커밋이 명시적으로 겨냥한 "게이트가 의도 밖 경로를 스치듯 통과시킨다" 는 결함과 **같은 클래스**의 잔여 구멍이다 — `spec/` 밖을 가리키는 `spec_impact` 가 여전히 게이트를 통과할 수 있다.
  - 제안: `path.join` 결과가 `spec/` 하위에 실제로 남아있는지(`path.relative(path.join(root,"spec"), resolved).startsWith("..")` 등으로) 재검증하거나, `p` 에 `..` 세그먼트가 포함되면 즉시 reject.

- **[INFO]** `rawScalar` 정규식 축소(`^[ \t]*key:` → `^key:`)는 이 리뷰 대상 3개 파일 밖의 소비처(`plan-frontmatter.test.ts` 의 `checkPlanFrontmatter` → `isIsoDate` → `rawScalar` 체인)에도 동일하게 적용되는 공유 유틸리티 변경이다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:219`
  - 상세: `rawScalar` 는 Gate C(`spec-plan-completion.test.ts`)와 in-progress frontmatter 가드(`plan-frontmatter.test.ts`, 이번 리뷰 payload 에는 포함되지 않음) 양쪽이 공유한다. 이번 변경은 "top-level 키만 매치" 로 좁히는 버그 수정이라 방향성은 안전(매치가 줄어드는 쪽)하지만, 리뷰 payload 파일 목록에는 실제 두 번째 소비처가 빠져 있어 이 리뷰만으로는 그쪽 회귀 여부를 판단할 수 없다. 커밋 메시지가 "문서 가드 19파일 / 2873 tests PASS" 를 보고하므로 별도 실행으로 확인된 것으로 보이나, 부작용 관점에서는 "리뷰 스코프 밖 실제 소비처로 동작이 전파된다" 는 사실 자체를 기록해 둔다.
  - 제안: 없음(정보성) — 이미 커밋 메시지에서 전체 스위트 통과를 보고했으므로 추가 조치 불요.

- **[INFO]** `makeSpecExists` 강화는 `plan/complete/**` 전체의 기존 `spec_impact` 리스트 선언(커밋 메시지 기준 233건)에 소급 적용되는 공유 검증 로직 변경이다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:112-127`(`makeSpecExists`), 소비처는 `:139`(`const specExists = makeSpecExists(root);`)
  - 상세: 함수 시그니처(`(root) => (p: string) => boolean`)는 그대로지만 내부 판정이 엄격해져, `spec/` 밖을 가리키던 기존 선언이 있었다면 CI 게이트가 새로 실패로 전환된다. 이는 이 fix 의 의도된 목적이며 커밋 메시지가 "완료 plan 233건의 리스트가 제약을 그대로 통과한다" 를 실측으로 보고했으므로 현재 데이터에는 회귀가 없다. 다만 공유 검증 함수 하나의 변경이 저장소 전역 게이트 판정에 넓게 파급되는 형태라는 점을 기록한다(부작용이라기보다 "넓은 blast radius" 성격).
  - 제안: 없음(정보성).

## 요약

이번 diff 는 두 지점(`rawScalar` 정규식 축소, `makeSpecExists` 의 `spec/` 접두사 강제)에 국한된 소규모 fix 로, 함수 시그니처·공개 인터페이스·환경 변수·네트워크 호출·전역 변수 도입은 없다. 두 변경 모두 검증 로직을 **더 엄격하게** 좁히는 방향이라 기존에 통과하던 값이 새로 실패로 전환될 수 있는 잠재적 파급(특히 `rawScalar` 는 리뷰 스코프 밖의 `plan-frontmatter.test.ts` 소비처에도 영향)이 있으나, 커밋 메시지가 실데이터 검증(233건 안전) 과 전체 스위트 통과를 보고하고 있어 실질 회귀는 낮다. 유일하게 실질적인 잔여 결함은 `makeSpecExists` 의 `spec/` 접두사 검사가 `..` 경로 순회를 막지 못해 저장소 루트 밖 파일에 대한 `statSync` 를 허용한다는 점 — 이번 커밋이 닫으려던 "의도 밖 경로 통과" 결함과 동일 클래스의 구멍이 하나 더 남아 있다. 테스트 파일들의 임시 디렉터리 생성/삭제(`fs.mkdtempSync`/`fs.rmSync`)는 이번 diff 로 신규 도입된 것이 아니며 `afterAll` 로 정리되므로 별도 항목으로 올리지 않았다.

## 위험도

LOW
