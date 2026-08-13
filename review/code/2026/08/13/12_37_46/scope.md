# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** CCH-SE-02 요구사항 행 편집이 "메커니즘 상세 제거 + 포인터 추가" 외에 문구 하나를 새로 보탰다
  - 위치: `spec/5-system/15-chat-channel.md:88` (게이트 88, `+` 라인)
  - 상세: diff 는 `Redis SET NX EX 30`·키 포맷 리터럴을 제거하고 `data-flow/14 §2.2` 참조로 바꾸는 것이 주 목적인데, 그 과정에서 "그 구간엔 중복 처리가 가능하다" 라는 설명과 `(+warn)` 표기 삭제가 함께 들어갔다. 계획 서술("요구사항 행은 무엇이 요구되는가만 남긴다")의 범위 안에서 해석 가능한 최소 보강이라 스코프 위반으로 보기는 어렵지만, "무엇이 요구되는가" 문구 손질치고는 정보량이 늘었다(fail-open 의 함의 서술 추가) — 의도된 3건 중 어디에도 명시적으로 예고되지 않은 부분이다.
  - 제안: 별도 조치 불요. 리뷰 기록 목적의 참고 사항.

## 요약

`git diff origin/main --stat` 실측 결과 이 changeset 은 프롬프트에 제시된 5개 파일과 정확히 일치하며(`public-webhook-quota.service.ts` +4/-2, `plan/in-progress/backend-lint-gate-broken-on-main.md` +39/-2, `spec/4-nodes/4-integration/4-cafe24.md` +23/-5, `spec/5-system/15-chat-channel.md` +1/-1, `spec/conventions/redis-keys.md` +1/-1), origin/main 대비 커밋은 단 1개(`b6d5c40b0`)뿐이다. 커밋 메시지가 "백로그 잔여 3건" 이라는 제목으로 정확히 이 diff 의 세 구성요소를 하나씩 열거한다 — ① `public-webhook-quota.service.ts` 상수 docstring 2줄의 "슬라이딩 윈도우" 오표기를 "fixed-window" 로 정정(자매 서비스·같은 파일 내 다른 docstring·spec 과의 불일치를 근거로 실측 후 수정), ② `4-cafe24.md` §9.8 Rationale 에 있던 순수 기술 명세(Redis 키 용도·TTL·degradation 표)를 새 §4.4(normative) 로 이관하고 §9.8 은 설계 근거만 남기도록 재구성, ③ `15-chat-channel.md` CCH-SE-02 행에서 구현 메커니즘 상세(Redis 명령·키 포맷)를 제거하고 `data-flow/14 §2.2` 참조로 대체. `redis-keys.md` 의 1줄 변경은 ②의 §9.8→§4.4 이관에 따른 인벤토리 포인터 동기화이고, `plan/in-progress/*.md` 의 39줄 추가는 이 세 항목의 체크박스 `[ ]→[x]` 전환 + 완료 근거 서술로, 프로젝트 관례("plan 체크박스 = 실제 상태")를 정확히 따른다. 세 항목 모두 같은 plan 문서의 기존 체크리스트 항목(전회 리뷰 세션 `12_17_38`/`12_24_14`/`redis-keys-pointer-integrity` 실측에서 등록된 백로그)이었고, 이번 diff 는 그 세 항목을 정확히, 그 이상도 이하도 없이 해소한다. 코드 변경은 주석(docstring) 2줄로 국한되어 로직·동작 변경이 전혀 없고, import·설정 파일·무관 파일·포맷팅 전용 변경은 발견되지 않았다. 유일한 특이점은 CCH-SE-02 편집에서 "메커니즘 상세 제거" 외에 fail-open 함의를 설명하는 문구 하나가 추가된 것인데, 이는 계획이 명시한 "요구사항이 무엇인가는 남긴다" 의 취지 안에 있는 최소한의 보강으로 판단되며 범위 이탈로 보기 어렵다.

## 위험도

NONE
