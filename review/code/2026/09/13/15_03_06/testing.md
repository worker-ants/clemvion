# 테스트(Testing) 리뷰 — guide-identifier-existence (#1330 → #1331 재설계 + 리뷰 라운드 1 fix)

## 검증 방법

프롬프트가 diff 를 생략한 신규 파일(`guide-identifier-existence.test.ts`, `guide-identifier-scan.ts`)은
worktree 에서 직접 `Read` 로 전문을 확인했다. 추가로 `npx vitest run` 으로 실제 GREEN 을 재확인하고,
코드 주석이 스스로 단 두 가지 "이 병합은 오늘 판정을 지탱하지 않는다"류 주장을 **뮤테이션으로 직접
반증/검증**했다(사용자 메모: 설계 근거는 쓰기 전에 뮤턴트로 반증해 보라). 모든 뮤테이션은 저장소 밖
scratch 사본을 기준으로 대조 후 `cp` 로 즉시 원복했고, 최종 `git status --short` 로 저장소가 깨끗함을
확인했다(세션이 생성한 미커밋 `review/**` 디렉터리만 남음).

```
npx vitest run src/lib/docs/__tests__/guide-identifier-existence.test.ts
  → Test Files 1 passed / Tests 19 passed (19)  — 원본 그대로 GREEN
```

## 발견사항

- **[WARNING]** `collectEnvDeclarations` 의 "주석 처리된 env 선언" 매칭 분기가 **완전히 무검증**이다 — 실측(뮤테이션)으로 확인
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` — `collectEnvDeclarations` 내부 `envLine` 정규식 (`const envLine = new RegExp(`^#?\\s*(${UPPER_SNAKE})=`, "gm")`)
  - 상세: 이 정규식의 `^#?\s*` 는 "주석 처리되어 남아 있는 `#SOME_VAR=` 형태의 선언"까지 잡으려는 의도로 보인다. 이 분기를 `^(${UPPER_SNAKE})=`(주석 허용 제거)로 뮤테이션해 `npx vitest run` 을 재실행했더니 **19/19 가 그대로 GREEN** 이었다 — 즉 이 분기의 존재 여부를 구별하는 테스트가 하나도 없다. 원인은 이중이다: (1) `collectEnvDeclarations` 를 직접 겨눈 합성 단위 테스트가 없다(자매 함수 `scanIdentifierCitations` 는 "축별 대조군" `describe` 블록으로 각 정규식 분기를 개별 fixture 로 겨누는데, 이 함수는 그런 대조군이 없다). (2) 실제 코퍼스로 간접 검증하려 해도 `codebase/backend/.env.example`·`codebase/frontend/.env.example` 어디에도 `^#[A-Z_]+=` 형태의 주석 처리된 선언 줄이 **0건**이라(직접 grep 확인) 오늘 저장소로는 이 분기가 절대 실행될 일이 없다. 이 함수 자체가 "오늘 판정을 지탱하지 않는다"(스캐너 docstring 자인)는 것과는 별개로, **그 안의 특정 정규식 분기 하나가 통째로 죽은 코드처럼 무검증 상태**라는 것이 이번에 새로 드러난 사실이다.
  - 제안: `collectEnvDeclarations` 를 겨눈 합성 단위 테스트를 `scanIdentifierCitations` 대조군과 같은 패턴으로 추가한다 — 최소 두 케이스: `"#SOME_VAR=x\n"` 를 넣었을 때 `SOME_VAR` 이 잡히는 케이스, 그리고 (의도가 "주석은 무시해야 한다"라면) 오히려 이 분기를 제거하는 것이 맞는지 재검토. 지금 상태로는 "의도"와 "테스트가 보장하는 것"이 갈라져 있다.

- **[INFO]** `collectEnvDeclarations`/`collectSourceTokens` 는 실제 저장소 파일을 통한 간접 검증만 받고, 자매 함수 `scanIdentifierCitations` 수준의 합성 단위 테스트가 없다 (architecture 리뷰 INFO#10 과 동일 지적, 테스트 관점에서 재확인)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:162-214` (두 함수 전체)
  - 상세: `scanIdentifierCitations` 는 `describe("scanIdentifierCitations — 축별 대조군", ...)` 블록에서 8개 fixture 로 각 축의 포착·비포착 경계를 정밀하게 겨눈다. 반면 `collectSourceTokens`/`collectEnvDeclarations` 는 실제 `codebase/backend/src`·`codebase/packages`·`.env.example`·`docker-compose*.yml` 을 읽어들인 결과의 **총량**(`sourceTokens.size > 800`, `envOnly.length > 5`)과 **특정 토큰의 존재**(`MODEL_CONFIG_NOT_FOUND`, `POSTGRES_PASSWORD`)만으로 간접 검증된다. 위 WARNING 이 보여주듯 이 방식은 정규식의 세부 분기 하나를 놓칠 수 있다.
  - 제안: 우선순위는 낮음(스캐너 두 함수 모두 정규식이 단순하고 오늘 코퍼스로 실질 오탐이 없음을 이미 실측했다). 위 WARNING 을 해소하는 김에 같이 정리하면 비용이 낮다.

- **[INFO]** "각 항목이 여전히 가이드에 인용된다"/"기준집합에 없다" 등 `GUIDE_EXTERNAL_VOCABULARY` 4강제 테스트는 실제 MDX 코퍼스에 의존 — 설계상 의도된 결합이며 문제는 아님
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:128-154`
  - 상세: 이 4개 테스트(항목 사유 명시·상한 5·여전히 인용됨·기준집합 배제)는 전부 real corpus(`citations`, `basis`)를 참조한다. 이는 결함이 아니라 이 가드 가족 전체의 설계 원칙(vitest 를 SoT 대조 도구로 쓴다)과 일치하며, mock 으로 대체하면 오히려 "허용목록이 죽은 항목을 누적하지 않는다"는 보장 자체가 사라진다. 참고용으로만 기록.

- **[INFO]** 회귀 재현 테스트("[회귀] `#1330` 의 문맥-게이팅 축이었다면 놓쳤다")는 현재 프로덕션 코드가 아니라 삭제된 옛 구현의 정규식을 로컬에 손으로 재작성해 검증한다 — 실질 커버리지 기여는 0, 문서화 목적 (architecture 리뷰 INFO 와 동일 지점, 테스트 카운트 관점에서 명시)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:179-187`
  - 상세: `CODE_CONTEXT`/`FIELD_TABLE_NAME` 리터럴은 이 파일에서만 존재하고 `guide-identifier-scan.ts` 의 어떤 export 와도 연결되지 않는다. "19 passed" 라는 숫자에 이 테스트가 포함되지만, 이 테스트가 실패해도 현재 가드 구현의 결함을 의미하지 않고, 성공해도 현재 구현의 정확성을 보장하지 않는다 — 순수하게 "역사적 사실(문맥 게이팅이 이 사례를 놓쳤었다)"을 코드로 고정한 문서다. 의도 자체는 합리적(과거 결함의 근거를 산문 대신 실행 가능한 형태로 보존)이나, 커버리지 수치를 읽는 다음 사람이 이 1개(엄밀히는 하위 2개 assert)를 "현재 구현 검증"으로 착각하지 않도록 주석에 이미 "[회귀]" 태그가 있는 점은 적절하다.
  - 제안: 조치 불요. 다만 architecture 리뷰가 제안한 "삭제 커밋 SHA 를 주석에 박아 대조 가능하게" 를 적용하면 이 테스트의 정본 대조 가능성이 올라간다.

- **[INFO]** (긍정 확인) 스캐너 docstring 의 자기-반증적 주장("env 병합을 통째로 빼도 스위트는 GREEN 이다")을 뮤테이션으로 직접 검증 — 참으로 확인됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:183-190`(주석) / `guide-identifier-existence.test.ts:60`(`basis` 병합)
  - 상세: `basis = new Set([...sourceTokens, ...envTokens])` 에서 `...envTokens` 를 제거한 뮤턴트로 전체 스위트를 재실행했다 — 19/19 GREEN 유지, 주장과 일치했다. 사용자 메모(`feedback_design_rationale_must_be_mutation_tested`)가 요구하는 "쓰기 전 반증"에 해당하는 실측이 이미 코드 주석 자체에 (다른 라운드에서) 반영돼 있고, 이번 재검증도 이를 뒷받침한다. 결함 아님 — 신뢰도 확인용으로 기록.

## 회귀 테스트 유효성

이전 라운드(`review/code/2026/09/13/14_41_14`) testing WARNING#6(재작성 시 실코퍼스 이름-고정 회귀 단언이 합성 fixture 로 전부 갈렸던 문제)은 이번 커밋에서 해소됨을 확인했다 — `discord.en.mdx`/`EXECUTION_TIMEOUT`, `mcp-servers.mdx`/`MCP_ALLOW_INSECURE_URL` 두 named-corpus 단언이 `guide-identifier-existence.test.ts:95-107` 에 복원돼 있고, `npx vitest run` 으로 GREEN 도 재확인했다. 또한 자매 파일 `guide-sanitized-message-parity.test.ts` 의 죽은 참조("자매 `guide-error-code-existence.test.ts`")도 이번 커밋에서 `guide-identifier-existence.test.ts`(+ 옛 이름 각주) 로 정정돼 있다.

## Mock 적절성 · 테스트 격리 · 용이성

- Mock 은 전혀 쓰지 않는다 — `fs.readFileSync`/`readdirSync`/`existsSync` 로 실제 저장소를 읽는다. 이 가드 가족(자매 5개)의 확립된 관례와 일치하며, mock 으로 바꾸면 "가이드가 실제로 무엇을 인용하는지" 를 검증한다는 가드의 존재 이유 자체가 사라지므로 적절하다.
- 테스트 격리: `describe` 스코프 최상단에서 `root`/`mdxFiles`/`sourceTexts`/`basis`/`citations` 를 한 번 계산해 여러 `it` 이 read-only 로 공유한다. 뮤테이션·순서 의존이 없어 격리 문제 없음.
- 테스트 용이성: `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations` 모두 순수 함수(문자열/배열 입력, `Set`/배열 출력)로 설계돼 fs 의존을 테스트 바깥(`guide-identifier-existence.test.ts`)으로 밀어냈다 — 함수형 코어/명령형 셸 분리가 잘 지켜져 있고, 이것이 "축별 대조군" 같은 정밀 fixture 테스트를 가능케 한 구조다.

## 요약

새 가드(`guide-identifier-existence`)는 vacuity floor·축별 대조군·경계 케이스·회귀 재현·허용목록 4강제까지 갖춘, 이 저장소 기준으로 상당히 성숙한 테스트 설계다. 이전 라운드가 지적한 "회귀 단언이 합성으로 갈렸다"·"자매 파일 죽은 참조" 문제는 이번 커밋에서 실제로 해소됐음을 직접 실행·grep 으로 확인했다. 유일하게 새로 발견한 실질 갭은 `collectEnvDeclarations` 의 주석-처리 env 선언 매칭 분기가 뮤테이션으로 확인될 만큼 완전히 무검증이라는 점이며, 이는 오늘 이 병합 자체가 판정을 지탱하지 않는다는 코드 스스로의 자인과 맞물려 있어 실질 리스크는 낮다. 나머지는 architecture 리뷰와 겹치는 INFO 급 관찰(합성 단위 테스트 부재, 죽은 코드 손 복제 회귀 테스트)이다. CRITICAL 급 테스트 결함은 없다.

## 위험도

LOW
