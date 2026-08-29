# 문서화(Documentation) 리뷰 결과

## 검증 방법

이 diff 는 `eslint 10` 상향의 `preserve-caught-error` 룰 대응으로 붙인 `cause: err` 부착/비부착에 대한
인라인 주석 5곳을 "요약을 인라인에 두지 않고 정본(`spec/5-system/3-error-handling.md` §6.3.1)을
참조"하는 형태로 정리한 문서화 전용 변경이다. 아래를 저장소에서 직접 열어 교차검증했다 (읽기 전용,
뮤테이션 없음):

- `spec/5-system/3-error-handling.md` §6.3.1 이 실제로 존재하고, C1(message 가 원본을 이미 포함) ·
  C2(`err` 가 message·name 밖 민감 속성을 안 들고 있음) 기준과 `SecretResolverService.resolve` 를
  비부착 정본 사례로 지목하는 서술이 5곳 주석의 인용과 정확히 일치함을 확인.
- `grep -rn "preserve-caught-error"` 로 프로젝트 전체를 훑어, 이번에 갱신되지 않은
  `secret-resolver.service.spec.ts:201` 의 관련 JSDoc 이 C1/C2 를 인라인에 재서술하지 않는 형태라
  갱신 대상이 아님을 확인 (drift 없음).
- `grep -rln "C1 AND C2\|C1 — \|C2 — "` 로 프로젝트 전체에서 다른 "C1/C2" 라벨 사용처(cafe24
  REQ-C2/SEC-C2, agent-memory 의 SQL 파라미터 바인딩 C1, websocket spec 의 2026-06-03 결정 C2)를
  확인 — 전부 이번 에러 `cause` 기준과 무관한 별개 명명이라 혼동·잔존 오참조 없음.
- plan 파일이 인용하는 `#1230`(스펙 정본화 커밋), `#1228`(spec-draft 문서 `complete/` 이동),
  `review/consistency/2026/08/29/00_13_01` 산출물을 각각 `git log`/`ls` 로 실측 대조 — 전부 일치.

## 발견사항

- **[INFO]** `secret-resolver.service.ts` 의 비부착 사유 주석이 C1 미충족만 명시하고 C2 는
  언급하지 않는다 (`preserve-caught-error` disable 자리, §6.3.1 은 AND 조건이라 C1 실패만으로 결론이
  나므로 정확하지만, 형제 3곳 주석은 모두 "C1 — … C2 — …" 2줄 구조로 통일돼 있어 이 자리만 구조가
  다르다).
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:89-92` (게이트 기준,
    diff 상 `+` 줄)
  - 상세: 논리적으로는 옳다(C1 이 거짓이면 AND 전체가 거짓이라 C2 를 따질 필요가 없다). 다만 나머지
    4곳(부착 사례 3곳 + 관련 spec 주석)이 "C1 — … C2 — …" 형태를 일관되게 쓰는 것과 대조하면, 이
    자리만 "C1 이 성립하지 않는다" 로 끝나 처음 읽는 사람이 "C2 는 검토했나?" 를 되물을 여지가
    남는다.
  - 제안: 사소한 스타일 차이이며 §6.3.1 정본을 정확히 반영하고 있어 수정을 요구할 정도는 아니다.
    다음에 이 주석을 다시 만질 일이 있으면 "C1 이 거짓이므로 C2 는 판정 불요" 한 줄만 덧붙이면 형제
    3곳과 형식이 완전히 맞아떨어진다.

## 그 외 점검 관점별 확인 (이상 없음)

- **독스트링/JSDoc**: 이번 diff 는 기존 함수/클래스에 인라인 주석만 추가했고 새 공개 함수·클래스가
  없어 JSDoc 신설 의무 없음. 기존 JSDoc(`resolveConfig`, `buildExpressionContext`,
  `buildTriggerView`, `buildEnvView` 등)은 diff 로 인해 깨지지 않았다.
- **README/API 문서**: 새 기능·엔드포인트·설정 옵션 없음 — 업데이트 불요.
- **CHANGELOG**: 이 변경은 사용자 관측 가능한 동작 변화가 없다(§6.3.1 Rationale 이 이미 "현재
  `.cause` 를 직렬화하는 소비처가 0곳" 임을 실측해 뒀고, 이번 diff 는 그 판단 근거를 설명하는 주석
  정리일 뿐이다). 이 저장소의 `CHANGELOG.md` 는 "운영 영향" 이 있는 변경만 기록하는 관례라(dev
  tooling/lint 대응은 과거에도 미등재) 이번 건도 등재 불요로 판단.
- **주석 정확성**: `expression-resolver.service.spec.ts` 의 옛 주석이 §6.3.1 도입 전 "C1 만" 적고
  있던 drift 를 이번 diff 가 실제로 교정했다(plan 파일이 스스로 이 사실을 실측 기록함). 5곳 모두
  정본과 대조해 불일치 없음.
- **인라인 주석**: `isolated-vm` cross-realm 이슈(`code.handler.ts`/`code.handler.spec.ts`)에 대한
  설명이 실제 테스트 단언 형태(`toBeDefined` vs `toBeInstanceOf(Error)`)와 정확히 일치함을 코드
  대조로 확인.
- **설정 문서**: 새 환경변수 없음.
- **예제 코드**: 신규 사용 패턴 없음 — 불요.
- **plan 문서 위생**: `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 자기반증 정정
  블록(2026-08-29)이 "봉인된 `complete/` 문서에 조건부 처분을 남기면 유실된다" 는 이 저장소의 기존
  교훈을 그 자리에서 실제로 재현·정정한 사례로, 취소선 보존 + 실측 근거 인용 등 프로젝트 plan 위생
  관례를 그대로 따르고 있다. `spec_impact: none` 은 이 브랜치가 `spec/` 을 건드리지 않는 것과
  일치(§6.3.1 은 별도 커밋 `#1230` 이미 병합됨).

## 요약

이번 diff 는 신규 기능이 아니라 기존 5곳의 인라인 주석이 정본(spec §6.3.1)과 갈리지 않도록
"요약 대신 참조 + 이 자리가 기준을 만족하는 방식만 기술" 하는 패턴으로 정리한 문서화 개선 PR이다.
스펙 인용·PR 번호·플랜 이동 이력을 모두 저장소에서 직접 열어 대조했고 전부 일치했다. 발견된 사항은
스타일 일관성에 대한 INFO 1건뿐이며, 기능·README·API·CHANGELOG·설정 문서 어느 관점에서도 갱신
누락이 없다.

## 위험도

NONE
