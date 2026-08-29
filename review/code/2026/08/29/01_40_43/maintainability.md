# 유지보수성(Maintainability) 리뷰

## 개요

이번 diff 는 실질적으로 6개 파일(소스 3 + spec 2 + plan 1)의 **주석/문서 수정**이고, 나머지
19개 파일(`review/code/2026/08/29/01_07_51/**`, `review/consistency/2026/08/29/01_30_29/**`)은
직전 리뷰·컨시스턴시 체크 라운드의 산출물이 이번 커밋에 함께 실린 것으로, 코드가 아니라 리포트
데이터다 — 유지보수성 관점(가독성/네이밍/함수 길이/중첩/매직넘버/중복/복잡도)의 적용 대상이
아니다.

실제 코드/테스트 파일 5곳은 `err` `catch` 블록에서 `cause: err` 부착 여부를 판단하는 근거 주석을
"요약을 인라인에 두는" 형태에서 "정본(`spec/5-system/3-error-handling.md` §6.3.1) 포인터 + 이
자리가 그 기준(C1 AND C2)을 어떻게 만족하는지만 로컬 서술" 하는 형태로 교체했다. 실행 로직(제어
흐름·함수 시그니처·throw 인자)은 diff 전후 바이트 단위로 동일함을 `Read` 로 직접 대조해 확인했다.

이 PR 은 직전 리뷰 라운드(`review/code/2026/08/29/01_07_51`)가 잡은 WARNING 1건(C2 서술에서
"민감" 한정어 탈락으로 인한 과잉 일반화, `expression-resolver.service.spec.ts`)의 fix 커밋이다.
현재 파일을 직접 열어 확인한 결과 그 WARNING 은 해소됐다: `expression-resolver.service.spec.ts:142`
에 "속성이 붙지 않는다" 앞에 "**민감**" 한정어가 정확히 들어가 있고, 리뷰가 지목하지 않았던 자매
2곳(`code.handler.ts:457`, `code.handler.spec.ts:203`)도 같은 형태로 동일하게 정정돼 있다 —
"리뷰가 지목한 1곳만 고치고 자매는 방치"하는, 이 저장소가 과거 반복해 온 패턴이 이번엔 재발하지
않았다.

## 발견사항

- **[INFO]** §6.3.1 포인터 보일러플레이트가 5곳(소스 3 + spec 2)에 반복되는 것은 직전 라운드에서도
  지적됐고 지금도 동일하게 유효하다 — 새로운 문제는 아니다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:316`,
    `codebase/backend/src/nodes/data/code/code.handler.ts:454`,
    `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:89`
    (+ 대응 spec 2곳: `expression-resolver.service.spec.ts:136`, `code.handler.spec.ts:200`)
  - 상세: "정본은 spec X, 여기 요약하지 않는다, 이 자리가 C1/C2 를 어떻게 만족하는지만 적는다" 라는
    도입부 문구 자체가 5곳에서 손으로 동기화돼야 한다. `§6.3.1` 이 재넘버링되면 5곳 모두 찾아 고쳐야
    하지만, 이 PR 자체가 "요약을 인라인에 남기면 정본과 갈린다"(실제로 `expression-resolver.service.spec.ts`
    가 한때 C1 만 적고 있다가 C2 도입 후 drift 났던 사례)는 실패를 겪은 뒤 나온 재발 방지 조치라
    지금 규모에서는 legit 한 트레이드오프로 판단한다.
  - 제안: 지금 조치 불필요(직전 라운드에서도 같은 결론). 6번째 `cause` 판단 지점이 추가되는 시점에
    `git grep '§6.3.1'` 점검을 CI 화하거나 참조 위치를 별도 문서에 등재하는 것을 고려.

- **[INFO]** `secret-resolver.service.ts` 의 `catch` 블록은 주석이 더 늘어(이번 diff 로 5줄 →
  약 15줄) 실질 코드(`eslint-disable-next-line` 1줄 + `throw new Error(...)` 1줄)보다 주석/코드
  비율이 한층 높아졌다.
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:86-100`
  - 상세: 이 자리는 저장소 유일의 "비부착(non-attachment)" 사례이자 보안 판단(crypto 에러 상세를
    사용자에게 노출하지 않기 위해 의도적으로 `cause` 를 떼는 지점)이라 근거를 온전히 남길 필요가
    있는 자리다. 다만 형제 3곳(부착 사례)이 "C1 — … C2 — …" 두 줄 구조인 것과 달리 이 자리는
    "C1 이 성립하지 않으므로 C2 는 판정 불요" 한 줄이 새로 추가돼(라인 92-93) 오히려 직전 라운드가
    지적한 형식 불일치(documentation INFO)를 해소했다 — 순증가라기보다 근거 재구성에 가깝다.
  - 제안: 별도 조치 불필요. 이 서비스에 `cause` 판단 지점이 하나 더 생기면 클래스 최상단 doc-comment
    로 공통 근거를 승격하는 선택지를 고려할 수 있으나 지금은 1곳뿐이라 과설계다.

- **[INFO]** `code.handler.ts` 의 소스 주석이 테스트 파일(`code.handler.spec.ts`)의 assertion 형태
  차이(cross-realm `SyntaxError` → `toBeDefined` vs `toBeInstanceOf(Error)`)까지 상호 참조로
  설명한다.
  - 위치: `codebase/backend/src/nodes/data/code/code.handler.ts:459-460`
  - 상세: 소스 파일 주석이 테스트 단언 형태를 언급하는 것은 다소 이례적이지만, 대칭 설명이
    `code.handler.spec.ts:219-231` 에도 있어 양방향 상호 참조 형태이고 두 파일 다 "상세는 반대쪽
    파일의 같은 주석" 이라고 명시해 순환 참조로 인한 혼란 위험이 낮다. 코드 로직 변경은 없다.
  - 제안: 없음(현행 유지 가능).

- **[INFO]** `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 자기정정 블록(취소선 + "정정
  (2026-08-29) — 실측이 반증했다")과 "등재됐다고 한 것이 거짓이었다" 인용 블록은 프로젝트의 plan
  위생 관례(조건부 처분을 봉인된 `complete/` 에 두면 유실된다는 기존 교훈)를 그 자리에서 실제로
  재현·정정한 사례로, 형식(취소선 보존 + 실측 근거 인용 + 인접 서술 비침해)이 CLAUDE.md 의
  "자기-반증형 소정정" 다섯 조건 형태를 잘 따르고 있다. 다만 중첩 인용 블록(`>` 3중첩, 라인
  356-399)이 상당히 길어(약 45줄) 한 번에 읽기에는 밀도가 높다.
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:337-399`
  - 상세: 코드가 아니므로 함수 길이/복잡도 기준은 적용되지 않으나, "PR 목적 자체가 재발했다" →
    "지적이 맞았다(실측)" → "리뷰 밖 정정(realm 귀속)" → "후속 항목 2건" 의 4단 서술이 한 인용
    블록 안에 이어져 있어 향후 이 plan 을 다시 열람할 사람이 시간순으로 무엇이 이 턴에 실제로
    바뀌었는지 추적하려면 다소 스크롤이 필요하다.
  - 제안: 조치 불필요(plan 문서 관례상 시간순 누적 기록이 정상 패턴). 향후 이 plan 이 `complete/`
    로 옮겨질 때 이 블록의 핵심 결론(3곳 정정 + 후속 2건 등재)만 상단 요약으로 뽑아두면 재열람
    비용을 줄일 수 있다.

## 요약

6개 실질 파일 모두 주석/문서 수정에 한정되며 실행 로직 변경은 없다 — 실측(현재 파일 내용 대조)으로
확인. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 관점에서 새로 도입된 문제는 없다. 이 PR 은 직전
리뷰 라운드가 잡은 WARNING(§6.3.1 C2 요약의 한정어 탈락)을 fix 하면서 **리뷰가 지목하지 않은 자매
2곳까지 전수로 찾아 함께 고쳤고**, 동시에 이전 턴의 잘못된 확신 주석(realm 귀속 오류)도 실측으로
반증해 취소선 정정했다 — 둘 다 이 저장소가 과거 반복 지적해 온 실패 패턴(부분 수정·미실측 확신
주석)을 이번엔 스스로 방지한 사례다. 남은 지적은 전부 INFO 등급으로, §6.3.1 포인터 보일러플레이트
5곳 반복(직전 라운드에서도 이미 legit 한 트레이드오프로 판단됨)과 plan 문서 인용 블록의 정보
밀도뿐이며 어느 것도 조치를 강제할 수준은 아니다.

## 위험도

NONE
