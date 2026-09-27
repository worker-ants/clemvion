# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** "보내지 않은 필드 제외 후 `Object.assign`" 관용구가 서비스 두 곳에 통째로(코드+장문 주석) 복제됐고, plan 상 세 곳이 더 예정돼 있다
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:72-80` (`update()`) — 동일 패턴이 `codebase/backend/src/modules/triggers/triggers.service.ts:618-626` 에도 있음(이번 diff 범위 밖, 기존 코드)
  - 상세: `const defined = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)); Object.assign(folder, defined);` 블록과, 그 위에 붙은 "DTO 인스턴스는 undefined own property 를 갖는다 → `useDefineForClassFields`" 로 시작하는 4~5줄 주석이 `triggers.service.ts` `update()` 와 사실상 동일하다(코드+근거 서술 모두). PR 본문(`plan/in-progress/folders-contract-e2e.md` "방향" §1, `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목)에는 같은 결함이 `workflows.service.ts` · `nodes.service.ts` · `auth-configs.service.ts` `update()` 에도 남아 있고 "같은 관용구로 고친다"고 명시돼 있다 — 즉 이 블록(코드+주석)이 5곳으로 복제될 예정이다. 이렇게 되면 이 로직이나 그 rationale 을 나중에 수정할 때 5개 파일을 동기화해야 한다.
  - 제안: `omitUndefinedFields<T extends object>(obj: T): Partial<T>` 같은 공용 헬퍼를 (예: `src/shared/` 또는 `src/common/`) 하나 두고 JSDoc 에 이 rationale(왜 `useDefineForClassFields` 가 문제인지, 증상 두 가지)을 한 곳에만 적은 뒤, 각 `update()` 는 `Object.assign(folder, omitUndefinedFields(data))` 한 줄만 쓰게 하는 편이 낫다. plan 문서 자체도 "착수할 때 개별 수정보다 공용 헬퍼 + 가드가 맞는지부터 판단한다"고 이미 이 방향을 인지하고 있다 — 이번 PR 로 두 번째 사본이 생겼으니, 세 번째 사본이 생기기 전(다음 PR)에 추출을 권장한다.

- **[INFO]** 새로 추가한 유닛 테스트 이름이 같은 `describe` 블록 내 기존 관례(영문)와 어긋난다
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts:117` (`it('보내지 않은 필드(undefined)로 로드한 값을 덮지 않는다', ...)`)
  - 상세: `describe('update — parentId 재검증 (V-04)', ...)` 블록 안의 다른 10개 `it()` 는 모두 영문 서술(`renames without parent change`, `rejects self as parent`, `allows moving to root` 등)이고 새로 추가된 테스트만 전체 한국어 문장이다. 파일 전체·블록 지역 관례와의 일관성(점검 관점 8)이 새 테스트에서만 깨진다.
  - 제안: 같은 블록의 다른 케이스처럼 영문 요약(예: `does not overwrite loaded values with undefined (unsent) fields`)으로 맞추거나, 팀이 한국어 `it()` 로 전환 중이라면 그 결정을 규약 문서에 남겨 다음 사람이 어느 쪽이 맞는지 헷갈리지 않게 한다.

- **[INFO]** 서비스 코드 주석이 테스트 케이스 라벨(`e2e C · E`)을 근거로 인용해, 두 파일이 독립적으로 드리프트하면 주석이 조용히 stale 해질 수 있다
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:72-76`
  - 상세: 주석 마지막 문장 "폴더 e2e C · E 가 드러냈다" 는 `codebase/backend/test/folder-crud.e2e-spec.ts` 의 `it('C. ...')`/`it('E. ...')` 라벨을 가리킨다. 이 라벨은 테스트 파일의 케이스 추가/재정렬만으로 바뀔 수 있는 반면 서비스 파일은 그 변경을 알 길이 없다 — 다음에 e2e 케이스가 재배치되면 주석의 "C · E" 인용이 실제로는 다른 케이스를 가리키게 된다. (주석의 나머지 부분 — 증상 두 가지, `useDefineForClassFields` 원인 — 은 자체 완결적이라 문제 없다.)
  - 제안: 케이스 문자 대신 파일명만 인용("`folder-crud.e2e-spec.ts` 참고")하거나, 케이스 문자를 인용할 경우 그 문자가 바뀌면 이 주석도 함께 갱신해야 한다는 점을 plan 체크리스트(또는 같은 주석)에 명시한다.

## 요약

핵심 변경(`folders.service.ts` 의 `update()` undefined-필드 필터, `FolderDto.parentId` 기본형 전환, 신규 e2e/유닛/캐너리 테스트)은 각각 범위가 좁고 목적이 분명하며, 함수 길이·중첩·매직 넘버 측면에서 문제가 없다. 모든 변경에 "왜"를 설명하는 풍부한 주석이 붙어 있어 가독성 자체는 높다. 다만 "undefined 필드 제외 후 Object.assign" 관용구가 이번 PR로 두 번째 파일에 통째로 복제됐고 plan 상 세 곳이 더 예정돼 있어 DRY 관점의 부채가 쌓이고 있으며(WARNING), 신규 유닛 테스트 하나가 같은 블록의 명명 관례를 깨고, 서비스 주석이 별도 파일의 테스트 케이스 라벨을 인용해 향후 드리프트 위험을 안고 있다(INFO 2건). 셋 다 병합을 막을 사안은 아니다.

## 위험도
LOW
