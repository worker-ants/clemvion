# 아키텍처 리뷰 — guide-identifier-existence

## 발견사항

- **[WARNING]** 리네임(`guide-error-code-*` → `guide-identifier-*`) 이 자매 모듈의 문서 참조를 놓쳤다 — 모듈 경계 서술 drift
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16` (직접 `Read` 로 확인, 이번 diff 밖의 기존 파일)
  - 상세: 해당 줄은 `자매 \`guide-error-code-existence.test.ts\` 는 **코드 토큰**의 실재를 본다` 라고 적혀 있다. 이번 PR 이 그 파일을 `guide-identifier-existence.test.ts` 로 리네임했으므로 이 문장은 더 이상 존재하지 않는 파일명을 가리킨다. `grep -rn "guide-error-code" codebase/` 로 확인한 결과 남은 참조는 이 자리와 `guide-identifier-scan.ts` 상단 주석(역사 서술 — 의도적 보존, `#1330`/`#1331` 각주로 구분됨) 둘뿐이며, 이 자리만 갱신에서 빠졌다. plan 체크리스트는 "`PROJECT.md` · 트래커 전방 참조 5곳" 을 리네임했다고 적어 완결을 주장하지만 자매 모듈의 크로스레퍼런스는 그 5곳에 포함되지 않았다 — 리네임 시 "누가 이 파일명을 문자열로 인용하는가" 를 전수 grep 하지 않고 알려진 참조처만 갱신한 형태다.
  - 제안: `guide-error-code-existence.test.ts` → `guide-identifier-existence.test.ts` 로 정정. 사소하지만 이 종류의 가드 가족은 자매 관계를 문서 주석으로 서로 가리키는 것이 관례이므로(예: `guide-identifier-existence.test.ts` 자신도 "자매 `impl-anchor-existence.test.ts`" 를 인용) 방치하면 다음 사람이 존재하지 않는 파일을 찾게 된다.

- **[WARNING]** `collectEnvDeclarations` 의 compose 파일 판별이 "저장소 루트의 아무 YAML" 에 암묵 결합 — 실제로는 무관 파일(784KB `pnpm-lock.yaml`)까지 읽고 파싱한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:48-51` (compose 파일 판별부) — 소비하는 파서는 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:180`(`composeLine` 정규식, `collectEnvDeclarations` 함수 내부)
  - 상세: `composeTexts` 는 `fs.readdirSync(root).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"))` 로 얻는다. 함수 docstring(`guide-identifier-scan.ts:151-166`)은 이 입력을 "compose 가 컨테이너에 주입만 하는 값" 이라고 서술하지만, 구현은 "compose 파일" 을 특정하지 않고 저장소 루트의 확장자만으로 판별한다. 실측(`ls`)해 보면 이 필터는 의도한 `docker-compose.yml`·`docker-compose.e2e.yml` 외에 `pnpm-lock.yaml`(784KB)·`pnpm-workspace.yaml` 도 함께 읽어 `composeLine` 정규식(`^\s+(UPPER_SNAKE):\s`)으로 스캔한다. 오늘은 두 파일 모두 그 패턴에 매치되는 줄이 0건이라(직접 실행해 확인) 판정에 영향은 없지만, 이 파일은 인터페이스(함수 시그니처·주석)가 약속한 "compose 파일" 이라는 개념을 실제로 강제하지 않는 암묵적 결합이다 — 저장소 루트에 다른 YAML(예: CI 설정)이 새로 생기면 그 파일의 임의의 `KEY:` 줄이 조용히 기준집합에 편입되어, 이 PR 이 공들여 문서화한 "env 병합은 오늘 판정을 지탱하지 않는다" 는 자기 실측 전제 자체를 다음 사람 모르게 흔들 수 있다. 이 파일의 다른 basis-set 확장 결정들(예: `packages` 포함 여부, env-only 병합 여부)은 전부 실측 표와 vacuity floor 로 근거를 고정해 두었는데, 이 한 지점만 그 규율에서 비켜나 있다.
  - 제안: 파일명 확장자 대신 명시적 목록/glob(`docker-compose*.yml`)으로 좁히거나, 최소한 이 함수 docstring 에 "저장소 루트의 모든 YAML 을 읽는다" 는 실제 동작을 정확히 적어 다음 사람이 그 결합을 알고 판단하게 한다.

- **[INFO]** 과거 결함 재현 테스트가 삭제된 구현의 정규식을 손으로 복제 — 실제 원본과의 연결이 git 이력뿐
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:163-167` (`[회귀] #1330 의 문맥-게이팅 축이었다면 놓쳤다`)
  - 상세: 이 테스트는 `CODE_CONTEXT`·`FIELD_TABLE_NAME` 정규식 리터럴을 로컬 상수로 다시 타이핑해 "옛 축이었다면 놓쳤다" 를 증명한다. 원본 `guide-error-code-scan.ts` 는 이 PR 에서 완전히 삭제됐으므로, 이 리터럴이 실제로 삭제된 구현과 문자 단위로 같은지 보장하는 것은 이제 git 이력 대조뿐이다(자동 링크 없음). 의도(역사적 술어를 문서로 고정)는 타당하고 현재는 실측 근거(§테스트 상단 표)와 함께 있어 위험은 낮지만, 이런 "죽은 코드의 손 복제" 가 늘어나면 다음 사람이 어느 쪽이 진짜 정본인지 추적하기 어려워진다.
  - 제안: 현 상태 유지 가능. 다만 주석에 "이 리터럴은 `<삭제 커밋 SHA>` 시점 `guide-error-code-scan.ts` 의 정의를 손으로 복제한 것" 이라고 커밋 해시를 박아 두면 향후 대조가 쉬워진다.

- **[INFO]** `guide-identifier-scan.ts` 가 세 이질적 책임(가이드 인용 축 스캐닝 / 큐레이션된 외부 어휘 데이터 / 소스·인프라 두 계열의 기준집합 수집)을 한 파일에 계속 누적하는 중 — 오늘은 응집도 문제 없음, 확장 시 분리 검토 지점
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체 (axis 정규식군 53-88행대 / `GUIDE_EXTERNAL_VOCABULARY` 97-107행대 / `collectSourceTokens`+`collectEnvDeclarations` 137-189행대)
  - 상세: 189줄 규모에서는 응집도가 충분하고(모두 "식별자 실재성" 도메인), 함수형 코어(순수 스캐너) / 명령형 셸(테스트의 fs 읽기) 분리도 잘 지켜졌다. 다만 이 파일은 서로 다른 변경 이유를 가진 세 축을 이미 품고 있다 — 가이드 마크업 형식이 바뀌면 axis 정규식이, 소스 트리 레이아웃이 바뀌면 `collectSourceTokens` 가, 인프라 설정 관례가 바뀌면 `collectEnvDeclarations`/`GUIDE_EXTERNAL_VOCABULARY` 가 바뀐다. `GUIDE_EXTERNAL_VOCABULARY` 상한(5)이 그대로 지켜지고 축이 3개 선에서 멈춘다면 분리 불필요하지만, 이 PR 자체가 "축이 하나 더 필요해졌다" 는 이력(에러 코드 전용 → 식별자 전반)을 막 반복했으므로 다음 확장 때 재고할 지점으로 기록해 둔다.
  - 제안: 지금 당장 조치 불요. 축이 4개를 넘거나 허용목록이 상한(5)에 근접하면 axis-scanning 모듈과 basis-collection 모듈을 분리하는 것을 검토.

## 요약

이번 변경은 `guide-error-code-existence`(에러 코드 전용, 문맥 게이팅 3축)를 폐기하고 `guide-identifier-existence`(에러 코드+환경변수, 문맥 무관 백틱 전수 축)로 대체하는 재설계다. 자신이 만든 가드가 그 가드를 만들게 한 원 결함(`MCP_INSECURE_URL_ALLOWED`)을 실측으로 못 잡는다는 것을 증명하고, "허용목록 없음" 원칙을 실측 근거와 함께 정당하게 번복했으며, 그 대가(외부 어휘 오탐)를 은폐 방지 4강제(외부 시스템 명시·상한·인용 유지·기준집합 배제)로 되갚는 설계는 SOLID·응집도 관점에서 건실하다. 순수 스캐너/명령형 셸 분리, 파일 전면 교체(중복 없음), 축 라벨 재사용 회피 등 이전 라운드(consistency-check)가 지적한 명명 충돌도 코드에 정확히 반영돼 있다. 남은 흠은 규모가 작다 — 리네임이 자매 모듈의 크로스레퍼런스 하나를 놓쳤고(모듈 경계 문서 drift), env 기준집합 수집이 "compose 파일" 이라는 개념을 확장자 필터로 암묵 근사해 저장소 루트에 좌우되는 취약한 결합을 하나 남겼다(오늘은 무해, 계약이 실동작보다 좁게 서술됨). 둘 다 CRITICAL 급 구조 결함은 아니다.

## 위험도

LOW
