# Testing Review

## 발견사항

### [INFO] createWebChatCorsDelegate 스텁 defaultOptions 와 프로덕션 팩토리 혼용
- 위치: `web-chat-cors.spec.ts` 라인 79–82, 라인 166–179
- 상세: 기존 `createWebChatCorsDelegate` describe 블록의 대부분 케이스는 `exposedHeaders` 없는 로컬 스텁 `defaultOptions` 를 사용한다. 이는 의도적 격리(다른 케이스들은 exposedHeaders 와 무관한 라우팅 로직만 검증)이므로 문제는 아니다. 다만 스텁과 실제 팩토리를 섞어 쓰는 패턴이 명시적으로 문서화되지 않아 나중에 유지보수자가 혼동할 수 있다.
- 제안: 로컬 스텁 `defaultOptions` 상단에 간단한 주석(`// 라우팅 로직만 검증하는 최소 스텁 — exposedHeaders 검증은 별도 케이스 참조`)을 추가하면 의도가 명확해진다.

### [INFO] `buildDefaultCorsOptions` null/undefined originCallback 엣지 케이스 미검증
- 위치: `web-chat-cors.spec.ts` 라인 182–200, `web-chat-cors.ts` 라인 126–134
- 상세: `buildDefaultCorsOptions` 는 `CorsOptionsLike['origin']` 타입을 받으며 해당 타입은 `undefined` 를 포함한다(optional field). 현재 테스트는 함수형 콜백만 검증하고, `undefined` 를 전달했을 때 반환 객체의 `origin` 필드가 `undefined` 인지 확인하는 케이스가 없다. 프로덕션 경로(main.ts)에서는 항상 `corsOriginCallback`이 주입되므로 runtime 위험은 낮지만, 타입이 허용하는 경계값이 검증되지 않는다.
- 제안: `buildDefaultCorsOptions(undefined)` 호출 시 `opts.origin === undefined` 임을 검증하는 케이스를 추가하거나, 파라미터 타입을 narrowing해 undefined를 명시적으로 배제한다.

### [INFO] `decide` 헬퍼의 `opts!` 단언 — err=null·opts=undefined 경로 미처리
- 위치: `web-chat-cors.spec.ts` 라인 14–17
- 상세: `decide` 헬퍼가 `resolve(opts!)` 로 non-null 단언한다. `createWebChatCorsDelegate` 가 항상 `opts` 를 전달하므로 런타임 이슈는 없지만, cb를 `(null, undefined)` 로 호출하는 경로가 추가될 경우 테스트가 `undefined` 를 resolve해 later assertions에서 오해하기 쉬운 오류가 발생한다. TypeScript strict 빌드에서 경고 없이 컴파일된다는 점도 주의.
- 제안: `resolve(opts ?? ({} as CorsOptionsLike))` 또는 `if (!opts) reject(new Error('no opts'))` 패턴으로 방어하거나, 현재 동작이 충분하다면 단언 이유를 주석으로 명시한다.

### [INFO] `resolveAllowlist` reject 경로 — credentials 검증 누락
- 위치: `web-chat-cors.spec.ts` 라인 138–151
- 상세: `resolveAllowlist` 실패 시 `origin: false` 만 검증하고 `credentials: false` 는 검증하지 않는다. 프로덕션 코드에서 `.catch(() => cb(null, { origin: false, credentials: false }))` 가 명시적으로 `credentials: false` 를 반환하는데 이 부분이 테스트 assertion 에 빠져 있다.
- 제안: 해당 케이스에 `expect(opts.credentials).toBe(false)` 를 추가해 fail-closed 시 credentials 도 안전하게 닫힘을 명시적으로 검증한다.

## 요약

이번 변경의 핵심 목표인 "동어반복 제거 → 실제 프로덕션 팩토리 직접 검증"은 완벽하게 달성됐다. `buildDefaultCorsOptions` 를 named export 로 추출해 스펙에 독립적인 단위 테스트가 가능해졌고, `createWebChatCorsDelegate` 에 exposedHeaders 전파 케이스를 추가해 WARNING #2 도 해소됐다. 테스트 구조는 격리·가독성·의도 표현 모두 양호하며, 이전 스냅샷 방식의 치명적 허점(프로덕션 코드 수정 → 테스트 여전히 PASS)이 실질적으로 수정됐다. 남은 관찰사항은 모두 INFO 수준으로, `resolveAllowlist` reject 시 `credentials: false` assertion 추가와 스텁 주석 보완이 권장되지만 현재 회귀 방지 효과를 저해하지 않는다.

## 위험도

LOW
