### 발견사항

- **[WARNING]** DTO에서 ownership 값 목록이 세 군데 중복 정의됨
  - 위치: `query-workflow.dto.ts` — `@IsIn(['mine', 'shared', 'all'])`, `@ApiPropertyOptional.enum`, TypeScript union type
  - 상세: 새 값(예: `'team-only'`)을 추가할 때 세 위치를 모두 수정해야 하며, 하나라도 누락되면 런타임 검증과 타입 정의가 어긋남. 반면 `status` 필드는 `string`으로 느슨하게 정의되어 일관성도 없음.
  - 제안: `const OWNERSHIP_VALUES = ['mine', 'shared', 'all'] as const; type Ownership = typeof OWNERSHIP_VALUES[number];` 로 단일 출처를 만들고 세 위치 모두 참조

- **[WARNING]** `ownership` 상태가 워크스페이스 전환 시 초기화되지 않음
  - 위치: `page.tsx` — `const [ownership, setOwnership] = useState<Ownership>("all");`
  - 상세: 팀 워크스페이스에서 `ownership='mine'`으로 설정한 뒤 개인 워크스페이스로 전환하면, API 파라미터는 `isTeamWorkspace` 가드 덕분에 전송되지 않지만 `ownership` state는 `'mine'`을 유지함. 다시 팀 워크스페이스로 전환 시 이전 필터가 그대로 복원돼 사용자가 예상하지 못한 결과를 볼 수 있음.
  - 제안: `currentWorkspace` 변경 시 `ownership`을 `'all'`로 리셋하는 `useEffect` 추가

- **[INFO]** 서비스 레이어에서 `workspace?.type` 가 `null`일 때 소유 필터가 묵시적으로 스킵됨
  - 위치: `workflows.service.ts` — `if (workspace?.type === 'team')`
  - 상세: `workspacesService.findById`가 `null`을 반환하면(존재하지 않는 워크스페이스) 소유 필터를 조용히 무시하고 전체 결과를 반환함. 실제로 이 엔드포인트는 이미 워크스페이스 존재를 검증한 뒤 호출되므로 문제가 발생할 가능성은 낮지만, 방어적 동작임을 주석으로 명시하거나 로그를 남기면 이후 디버깅이 용이함.
  - 제안: 현재 동작은 스펙과 일치하므로 변경 필수는 아님. 필요 시 `workspace ?? { type: 'personal' }` 폴백을 명시적으로 표현해 의도를 드러낼 수 있음.

- **[INFO]** 테스트 내 API 파라미터 추출 패턴 반복
  - 위치: `workflows-page.test.tsx` — 두 개 테스트에서 `listSpy.mock.calls.at(-1)?.[0] as Record<string, string> | undefined` 패턴이 중복
  - 제안: `getLastCallParams(spy)` 헬퍼 함수로 추출하면 파일 내 일관성이 높아지고 타입 캐스팅 위치가 한 곳으로 모임.

---

### 요약

변경 범위 전반적으로 기존 코드베이스의 패턴(필터 버튼 배열, `@IsIn` + `@ApiPropertyOptional` 조합, 서비스 내 `qb.andWhere` 체인)을 잘 따르고 있으며 순환 복잡도도 낮게 유지됐다. 가장 실질적인 유지보수 부담은 DTO의 ownership 값 삼중 중복으로, 현재는 세 값뿐이라 문제가 없지만 값이 추가될 때 일관성 깨짐의 전형적인 지점이 된다. 워크스페이스 전환 시 ownership 상태 미초기화는 사용자가 체감할 수 있는 버그 경로이므로 함께 처리할 것을 권고한다.

### 위험도

**LOW**