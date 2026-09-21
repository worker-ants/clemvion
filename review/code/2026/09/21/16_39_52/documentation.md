# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 이 결함 클래스(동시 DELETE → 감사 행 중복)의 형제 6건 전부가 지켜온 `CHANGELOG.md` 갱신 관례를 이번 PR만 건너뛰었다
  - 위치: 프로젝트 루트 `CHANGELOG.md` (이번 PR 3개 커밋 `ee8d7ead8`/`c52bbcb4b`/`a1312c02b` 중 어느 것도 이 파일을 건드리지 않음 — `git log --oneline -1 -- CHANGELOG.md` 는 여전히 7번째 형제(`c9f0e1a75`, auth-configs)를 가리킨다)
  - 상세: `git log`로 이 결함 클래스의 이전 6건을 확인하면 전부 `## Unreleased — …` 형태의 `CHANGELOG.md` 항목을 같은 커밋 또는 후속 커밋으로 남겼다 — workflows/workspace(#1369, `4a9828afe`), triggers(#1370, `4067bf777`), schedules(#1371, `fc5ea6b76`), integrations(#1372, `4d9064740`), member-remove(#1373, `3ba663db2`), auth-configs(#1374, `c9f0e1a75`). 심지어 한 번은 이 관례를 빠뜨렸다가 전용 백필 커밋(`197425f51 docs(changelog): 이 PR + #1373 CHANGELOG 관례 누락 backfill`)까지 만든 전례가 있어, 이 프로젝트가 이 관례를 가볍게 보지 않는다는 것이 git 이력으로 확인된다. 이번 PR(8번째 자리, `model-config`)은 `plan/in-progress/modelconfig-dup-delete.md` 체크리스트에도 CHANGELOG 항목이 아예 없다 — 빠뜨린 것인지 의도적으로 마지막(9번째, WebAuthn)과 묶어 한 번에 기록할 계획인지가 diff 만으로는 구분되지 않는다.
  - 제안: 형제 6건과 같은 형식(`## Unreleased — 동시 DELETE 두 건이 model_config.delete 감사 행을 두 번 남기던 것`)으로 `CHANGELOG.md` 항목을 추가하거나, 의도적 유예라면 plan 체크리스트에 그 사유를 명시할 것.

- **[WARNING]** `CHANGELOG.md`(7번째 형제, 이미 이 브랜치에 커밋됨)의 이 fix에 대한 예고가 이번 PR이 스스로 반증한 내용과 어긋난 채로 남아 있다
  - 위치: `CHANGELOG.md:40-41`
  - 상세: 7번째 형제(auth-configs) 커밋이 남긴 "**남는 것**" 문단은 "`ModelConfigService.remove()`(여덟 번째, 캐시 무효화 통지 `notifyInvalidated` 중복까지 함께 있음)"라고 이 fix를 예고한다. 그런데 이번 PR의 `plan/in-progress/modelconfig-dup-delete.md` §B("트래커에 내가 적은 것 하나가 과장이었다")는 정확히 같은 표현("캐시 무효화 통지 중복까지")이 트래커(`spec-draft-nullable-notation-followups.md`) 등재 시점의 과장이었음을 실측(리스너가 `clearClientCache` 하나뿐이고 멱등)으로 정정한다. 트래커 문서는 이번 diff(파일 5)에서 정정됐지만, 같은 과장을 반복 게재한 `CHANGELOG.md` 는 손대지 않았다 — 배포 이력에 남는 공개 문서에 이미 반증된 서술이 그대로 남는다.
  - 제안: 이번 PR이 CHANGELOG 항목을 추가할 때, 7번째 형제 항목의 해당 예고 문장에 각주나 취소선으로 정정을 남기거나, 새 항목의 "형제와 다른 점"에 "직전 항목의 '캐시 무효화 통지 중복까지' 서술은 과장이었다"는 한 줄을 넣을 것.

- **[INFO]** `remove()` 자체에는 여전히 함수 상단 JSDoc이 없다 — 인라인 주석만으로 계약을 설명
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `async remove(...)` 선언부(게이트 399)
  - 상세: 같은 클래스의 `findEntity`(게이트 126-130)·`resolveEmbedding`(게이트 196-209, `@param`/`@throws` 포함)·`saveWithDefaultSwap`(게이트 352-355)은 함수 상단 JSDoc을 갖지만, 이번에 동시성 계약(진 쪽 404 코드, `notifyInvalidated` 스킵)이 새로 생긴 `remove()`는 함수 본문 중간의 `//` 블록 코멘트로만 설명한다. 코멘트 자체는 매우 상세하고 정확하지만(`affected===0` 명시 비교 이유, FK cascade 실측, `rewriteTriggerConfigLocked`와의 규율 일치 등 전부 확인됨), 함수 시그니처만 보고 계약을 파악하려는 차기 독자는 본문을 끝까지 읽어야 한다.
  - 제안: 최소한 `@throws {NotFoundException} MODEL_CONFIG_NOT_FOUND — 조회 실패 또는 동시 삭제 패자` 정도의 한 줄 JSDoc을 얹으면 다른 public 메서드와 문서 밀도가 맞는다. 차단 사유는 아니다.

- **[관측 사항, 비-결함]** 리뷰 도중 저장소 트리에 일시적 뮤테이션 잔여물을 관측했으나 자체 해소됨
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (1줄 미커밋 diff) + 동일 디렉터리의 `model-config.service.ts.bak` (untracked)
  - 상세: 조사 중 `git status --short` 로 위 두 항목을 관측했다. 병렬 fan-out 리뷰 규약이 경고한 "다른 reviewer 의 뮤테이션"으로 추정된다. 직접 `git checkout`/`restore` 로 되돌리지 않았고, 재확인 시점(수 초 뒤)에는 이미 두 항목 모두 사라지고 `git status --short` 가 깨끗했다 — 다른 세션이 스스로 원복한 것으로 보인다. 이번 문서화 리뷰의 판정에는 영향 없음(리포트 시점 기준 코드는 diff와 일치). 기록만 남긴다.

## 요약

이번 diff(서비스 코드·단위 테스트·e2e 테스트·plan 문서) 자체의 주석·독스트링 품질은 높다 — `model-config.service.ts`의 `remove()` 코멘트는 FK cascade 실측(`V090:22`/`V091:23` 라인 정확), 판별자 규율(`rewriteTriggerConfigLocked`) 참조, 진 쪽 404 코드 선정 근거를 전부 검증 가능하게 남겼고, 오래된 주석("remove가 id를 지우므로 삭제 전에 읽는다")도 새 동작에 맞춰 정확히 교체됐다. 단위 테스트 주석도 vacuous 단언 제거 이유를 명시적으로 남겨 향후 회귀를 막는다. 다만 프로젝트 차원에서 볼 때, 이 정확히 같은 결함 클래스의 형제 6건이 예외 없이 지켜온 `CHANGELOG.md` 갱신 관례를 이번 PR만 건너뛰었고, 게다가 이미 배포된 `CHANGELOG.md` 항목이 이번 PR 스스로 반증한 과장된 예고를 그대로 담고 있다는 점이 문서 일관성 관점의 실질적 갭이다. 둘 다 기능에는 영향 없는 비차단 사안이다.

## 위험도
LOW
