### 발견사항

---

**[WARNING]** `EXECUTION_TRIGGER_SOURCES` 배열과 `ExecutionTriggerSource` 타입 중복 정의
- 위치: `execution-response.dto.ts:4-9`, `execution-trigger.ts:1-5`
- 상세: Swagger enum용 배열과 TypeScript 유니온 타입이 별도로 유지되어, 새 출처 추가 시 두 곳을 동시에 수정해야 한다. 현재는 `'manual'|'schedule'|'webhook'|'subworkflow'|'unknown'`이 두 파일에 각각 나열되어 있다.
- 제안: `as const` 배열 → `typeof` 파생 패턴으로 단일 정의로 통합.
  ```ts
  // execution-trigger.ts
  export const EXECUTION_TRIGGER_SOURCES = [
    'manual', 'schedule', 'webhook', 'subworkflow', 'unknown',
  ] as const;
  export type ExecutionTriggerSource = (typeof EXECUTION_TRIGGER_SOURCES)[number];
  ```
  그러면 DTO 파일에서 배열을 재선언하지 않고 `import { EXECUTION_TRIGGER_SOURCES }` 하나로 해결된다.

---

**[WARNING]** `ExecutionTriggerSource` 3중 정의 (프론트·백엔드 분리)
- 위치: `execution-trigger.ts:1`, `execution-response.dto.ts:4`, `frontend/src/lib/api/executions.ts:32`
- 상세: 동일한 유니온 타입이 세 파일에 각각 선언되어 있어, 새 출처를 추가할 때 세 군데를 모두 수정해야 한다. 모노레포이므로 공유 타입 레이어가 없으면 동기화 누락이 발생하기 쉽다.
- 제안: 단기적으로는 `frontend/src/lib/api/executions.ts` 파일 상단에 `// SYNC: backend ExecutionTriggerSource` 주석을 추가해 의무를 명시한다. 중기적으로는 `packages/shared-types` 같은 공유 패키지 도입을 검토한다.

---

**[WARNING]** 백엔드 `required` vs 프론트 `optional` 타입 계약 불일치
- 위치: `execution-response.dto.ts:33` (`triggerSource: ExecutionTriggerSource`), `frontend/src/lib/api/executions.ts:48` (`triggerSource?: ExecutionTriggerSource`)
- 상세: 백엔드 DTO는 `triggerSource`를 required로 선언했지만 프론트 인터페이스는 optional(`?`)로 정의되어 있다. `page.tsx`의 `?? "unknown"` 방어 코드가 불일치를 숨기고 있지만, 이후 필드를 기반으로 로직을 추가할 때 오인을 유발할 수 있다.
- 제안: 백엔드가 항상 필드를 내려준다면 `ExecutionData.triggerSource: ExecutionTriggerSource`로 optional 제거. API 계약을 타입에 정확히 반영한다.

---

**[WARNING]** JSX 내부 IIFE 사용 — 가독성 저하
- 위치: `page.tsx:300-330`
- 상세: `{(() => { const source = ...; return (...); })()}` 패턴이 테이블 셀 렌더링에 인라인으로 사용되어 있다. 렌더 함수 내에 즉시 실행 함수가 중첩되면 중첩 깊이가 올라가고, 나중에 동일 셀이 다른 위치에 필요할 때 재사용이 불가능하다.
- 제안: 트리거 셀을 별도 컴포넌트나 헬퍼 함수로 추출한다.
  ```tsx
  function TriggerCell({
    source,
    label,
  }: {
    source: ExecutionTriggerSource;
    label?: string | null;
  }) {
    const Icon = TRIGGER_ICON[source];
    return (
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
        <div className="min-w-0">
          <div className="truncate">{t(TRIGGER_LABEL_KEY[source])}</div>
          {label && (
            <div className="truncate text-xs text-[hsl(var(--muted-foreground))]" title={label}>
              {label}
            </div>
          )}
        </div>
      </div>
    );
  }
  ```

---

**[WARNING]** 테스트 코드의 반복적 `as never` 캐스팅
- 위치: `executions.service.spec.ts:58, 66, 68, 101, 105` 등 다수
- 상세: `executedBy: null as never`, `parentExecutionId: null as never` 패턴이 5개 픽스처에서 반복된다. `Execution` 엔티티가 실제로 null이 올 수 있는 컬럼을 TypeScript 상 non-nullable로 선언하고 있음을 드러내는 기술 부채다. 엔티티 타입이 잘못 표현된 상태에서 테스트가 `as never`로 우회하는 것은 컴파일러 보호를 무력화한다.
- 제안: `Execution` 엔티티에서 nullable 컬럼(`executedBy`, `parentExecutionId`, `triggerId` 등)을 `string | null`로 정확히 선언한다. 이렇게 하면 `as never`가 불필요해지고 타입 불일치가 컴파일 타임에 드러난다.

---

**[WARNING]** `findById`와 `findByWorkflow`의 반환 계층 불일치
- 위치: `executions.service.ts:26` (`Promise<Execution & {...}>`), `executions.service.ts:49` (`Promise<PaginatedResponseDto<ExecutionDto>>`)
- 상세: `findByWorkflow`는 이번 변경으로 DTO를 반환하도록 개선되었으나, `findById`는 여전히 raw `Execution` 엔티티를 반환한다. 같은 서비스의 두 조회 메서드가 다른 추상화 계층을 반환하여 일관성이 없다.
- 제안: 즉각 수정이 필요한 버그는 아니지만, `findById`도 `ExecutionDetailDto`를 반환하도록 후속 리팩토링을 계획한다.

---

**[INFO]** `unknown: "—"` i18n 표현
- 위치: `en.ts:1940`, `ko.ts:1933`
- 상세: 번역 파일이 의미 있는 텍스트 대신 em-dash(`—`) 시각 기호를 직접 담고 있다. 나중에 "Unknown" 텍스트로 표시하거나 접근성 대응이 필요해질 때 i18n 레이어와 UI 레이어의 경계가 불명확해진다.
- 제안: `"—"` 대신 `"Unknown"` / `"알 수 없음"` 등 의미 있는 텍스트를 두고, 대시 표현은 UI 컴포넌트에서 조건부로 렌더링한다. 단, 팀 컨벤션에 따라 허용 가능하다.

---

**[INFO]** `toIso` 단일 책임 메서드의 노이즈
- 위치: `executions.service.ts:183-185`
- 상세: `d instanceof Date ? d.toISOString() : d` 한 줄을 private 메서드로 감쌌다. `toExecutionDto` 내에서만 사용되며, 이 수준의 추출이 테스트 용이성이나 재사용을 실질적으로 높이지 않는다.
- 제안: 큰 문제는 아니나, 서비스 외부 유틸리티로 이동하거나 인라인 처리를 고려한다.

---

### 요약

전반적으로 이번 변경은 `deriveExecutionTrigger` 순수 함수 추출, N+1 방지 배치 쿼리, DTO 매핑 분리, 충분한 단위 테스트 추가 등 유지보수성을 높이는 방향으로 잘 설계되어 있다. 주요 개선 여지는 `ExecutionTriggerSource` 타입이 세 파일에 중복 정의된 점(새 출처 추가 시 삼중 수정 부담), 백엔드 required/프론트 optional 타입 계약 불일치, 테스트 코드의 반복적 `as never` 캐스팅(엔티티 타입 부채 노출)이며, JSX 내 IIFE는 소형 컴포넌트 추출로 가독성을 높일 수 있다.

### 위험도

**LOW**