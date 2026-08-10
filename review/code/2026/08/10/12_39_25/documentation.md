# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `start()` 의 `useCallback` 의존성 배열에 더 이상 참조되지 않는 `sessionEstablished` 가 남아 stale 함
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:612` (`}, [openStream, persist, seedWaitingFromStatus, scheduleRefresh, isStale, sessionEstablished, worldGenRef]);`)
  - 상세: 이번 diff 는 `start()` 본문에서 `if (sessionEstablished()) return; openStream(session, "0");` 를 `if (!openStream(session, "0")) return;` 로 교체해(게이트 596-601), `sessionEstablished()` 직접 호출을 `start()` 몸체에서 제거했다. 실제로 `sessionEstablished` 는 이제 `start()` 본문 어디에서도 호출되지 않는다(주석 텍스트로만 언급). 그런데 line 612 의 의존성 배열에는 `sessionEstablished` 가 여전히 남아 있다. React 콜백의 의존성 배열은 "이 콜백이 실제로 무엇을 참조하는가"를 알려주는 사실상의 문서 역할을 하는데, 지금은 실제 참조와 어긋난다. 기능적으로는 무해하다(`sessionEstablished` 는 `useCallback(..., [])` 로 항상 동일 참조라 재생성을 유발하지 않는다). 다만 이 파일은 과거에도 "ref 선언 사이 JSDoc 유실"·"가드를 한쪽에만 적용" 등 구조적 drift 가 반복된 이력이 있고(plan 문서 §배경, §JSDoc 인접성), 이번 diff 자체가 그 재발 방지를 목적으로 한 리팩터링이라는 점에서 이 잔여물은 특히 눈에 띈다. 향후 리더가 "왜 `sessionEstablished` 가 deps 에 있지?" 를 좇다 이미 사라진 참조를 찾게 될 수 있다.
  - 제안: `sessionEstablished` 를 `start()` 의 의존성 배열에서 제거(정확히는 eslint `react-hooks/exhaustive-deps` 가 원래 요구하는 실제 참조 집합과 재동기화)한다.

- **[INFO]** `openStream()` 새 JSDoc 이 파일의 다른 공개 콜백과 달리 `@param`/`@returns` 구조 태그 없이 산문으로만 작성됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:344-366` (`openStream` 앞 JSDoc 블록)
  - 상세: 같은 파일의 `safeApiBaseFromQuery`(gate 92-100), `finalizeEnded`(gate 267-282), `seedWaitingFromStatus`(gate 395-461) 는 모두 `@param`/`@returns` 태그로 시그니처를 명시한다. 반면 새로 추가된 `openStream` JSDoc(23줄, 매우 상세한 서사)은 반환값의 의미를 문단으로만 설명하고 `@param session`/`@param lastEventId`/`@returns` 태그가 없다. 내용 자체는 충분히 상세해 실질적 정보 손실은 크지 않으나, 이 파일의 기존 JSDoc 컨벤션과의 일관성이 깨진다(IDE 툴팁에서 `@returns` 요약이 안 뜨는 등 부수 효과도 있음).
  - 제안: 여유가 있으면 `@param session`/`@param lastEventId`/`@returns boolean — 다른 시도가 세션을 넘겨받았으면 false` 태그를 추가해 파일 컨벤션과 맞춘다. 필수는 아님.

- **[INFO]** `openStream` JSDoc 과 `seedWaitingFromStatus` JSDoc 이 동일한 microtask race 서사를 두 곳에서 거의 같은 문장으로 중복 서술
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:344-366` (openStream JSDoc "왜 게이트가 필요한가" 문단) 와 `use-widget.ts:439-450` (seedWaitingFromStatus JSDoc "이 seed 가드는 표면 되감기만 막는다..." 이하 문단)
  - 상세: 두 JSDoc 모두 "`await seedWaitingFromStatus` 와 `openStream` 사이 microtask 경계 → 겹친 두 seed 가 같은 flush 에서 resolve → 둘 다 스트림 미열림을 보고 통과 → 이중 EventSource" 서사를 반복 설명한다. 의도적으로 "호출부 관점"과 "게이트 관점" 두 곳에서 각각 필요한 설명이라 이해되지만, 이 파일이 이미 겪은 "한쪽만 갱신되고 반대쪽이 stale 로 남는" 패턴(이번 리뷰의 WARNING 항목과 같은 종류)이 이 두 JSDoc 사이에서도 재발할 여지가 있다 — 다음에 이 race 의 이해가 바뀌면 두 곳을 모두 찾아 고쳐야 한다.
  - 제안: 필수 조치는 아니나, 한쪽(예: `openStream`)에서 "상세 서사는 `seedWaitingFromStatus` JSDoc 참조"로 축약하고 다른 쪽에 canonical 서술을 남기는 것을 고려할 수 있다.

## 요약

이번 변경은 `openStream()` 을 `boolean` 반환으로 바꿔 스트림 소유권 게이트를 두 호출부의 손 복제 대신 함수 내부로 구조적으로 강제한 리팩터링이며, 새로 추가된 JSDoc 은 "왜 이렇게 했는가"·"과거에 어떤 결함이 있었는가"·"반환값의 의미"까지 상세히 기록해 이 파일의 높은 문서화 기준을 유지한다. 호출부 3곳(`start()`, `applyConfig` 복원 경로)의 인라인 주석도 게이트 이동에 맞춰 정확히 갱신됐고, `plan/in-progress/webchat-usewidget-extraction.md` 체크리스트 완료 기록도 뮤테이션 검증 결과·동등 뮤턴트 판단 근거까지 포함해 사실 확인(테스트 409건/23파일, `tsc --noEmit` 0 errors, `scheduleRefresh` 멱등성)이 모두 실측과 일치함을 확인했다. 유일한 실질적 흠은 `start()` useCallback 의존성 배열에 남은 `sessionEstablished` 잔여 참조(WARNING)로, 이는 이번 diff 가 본문에서 그 호출을 제거하면서 놓친 자기-참조 문서(의존성 배열)의 drift다. 그 외 두 건은 스타일 일관성/서사 중복에 대한 경미한 개선 여지(INFO)일 뿐 차단 사유는 아니다.

## 위험도

LOW
