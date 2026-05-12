### 발견사항

- **[WARNING]** `useEffect` 의존 배열에 `t` 함수 포함 — 반복 API 호출 위험
  - 위치: `register-form.tsx:79` — `}, [invitationToken, t]);`
  - 상세: `invitationsApi.getByToken` 호출 effect 의 deps 에 `t` 가 포함되어 있다. `useT()` 가 렌더마다 새 함수 레퍼런스를 반환하면 (i18n locale context가 갱신될 때마다) 이 effect가 재실행되어 초대 토큰 prefetch API를 중복 호출한다. `cancelled = true` cleanup 이 있어 race condition 은 차단되지만, 불필요한 네트워크 왕복이 발생한다.
  - 제안: `t` 를 deps 에서 제거하거나, effect 내부에서 사용하는 `t` 를 `useRef`로 안정화한다. `useT` 가 `useCallback`·stable reference 를 보장하면 현재 코드도 무해하므로, 우선 `useT` 구현 확인을 권장.

- **[INFO]** `lucide-react` 이중 import — 번들러 불필요 분석 유발
  - 위치: `workflows/page.tsx:19-25` (기존 named import 블록) + `:23` (새로 추가된 `import { Users }`)
  - 상세: 동일 패키지에서 두 개의 `import` 문이 존재한다. Tree-shaking 결과물에는 영향 없으나, TypeScript 컴파일러·bundler 가 모듈 그래프를 두 번 방문하고, 코드 가독성을 낮춘다.
  - 제안: 기존 named import 블록에 `Users` 를 합쳐 단일 import 로 정리.

- **[INFO]** 초대 목록 렌더마다 `new Date()` 생성
  - 위치: `workspace/settings/page.tsx` — `invitationsQuery.data.map` 내 `new Date(inv.expiresAt).getTime()`
  - 상세: `invitationsQuery.dataUpdatedAt` 과의 비교를 위해 매 렌더 + 각 항목마다 `Date` 객체를 생성한다. 초대 목록이 소규모(수~수십 건)인 운영 환경에서는 무시 가능한 수준이나, 만약 목록이 커지거나 렌더 빈도가 높아지면 누적 비용이 된다.
  - 제안: 현재 규모에서는 허용 범위. 향후 목록이 커질 경우 `useMemo` 로 변환값을 캐싱하거나, 서버 응답에 `expired: boolean` 필드를 포함해 클라이언트 계산을 제거하는 것을 고려.

- **[INFO]** 전체 재발송/취소 버튼이 단일 mutation pending 에 함께 비활성화
  - 위치: `workspace/settings/page.tsx` — `disabled={resendMutation.isPending}`, `disabled={revokeMutation.isPending}`
  - 상세: 한 초대의 재발송이 진행 중일 때 목록 내 **모든** 재발송 버튼이 비활성화된다. 성능 문제는 아니나, 사용자가 여러 초대를 연속 처리할 때 불필요한 대기를 유발한다.
  - 제안: `disabled={resendMutation.isPending && resendMutation.variables === inv.id}` 방식으로 행(row)별 pending 상태를 격리.

- **[INFO]** `Promise.all([fetchEnabledOauthProviders(), searchParams])` — 긍정적 변경
  - 위치: `register/page.tsx:10-13`
  - 상세: `searchParams` Promise 와 OAuth 프로바이더 fetch 를 병렬화한 것은 올바른 최적화다. 순차 await 대비 전체 페이지 TTFB 가 `fetchEnabledOauthProviders()` 지연만큼 단축된다.

---

### 요약

이번 변경의 성능 영향은 전반적으로 낮다. `Promise.all` 병렬화와 Zustand 선택자를 통한 단순 타입 판별은 올바른 패턴이며, 초대 목록 렌더링의 `new Date()` 생성도 현실적인 데이터 규모에서는 무시 가능하다. 가장 주의할 부분은 `register-form.tsx` 의 `useEffect` 의존 배열에 포함된 `t` 함수다 — `useT()` 구현이 안정적인 레퍼런스를 반환하지 않는 경우 초대 토큰 prefetch가 반복 호출될 수 있으며, 이는 불필요한 네트워크 비용과 서버 부하로 이어진다.

### 위험도

**LOW**