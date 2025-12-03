// frontend/app/page.tsx
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

/**
 * 메인 페이지 (로그인 필요)
 * - 로그인하지 않은 사용자는 RequireAuth 에 의해 /login 으로 리다이렉트
 * - 로그인한 사용자는 추후 "메인 대시보드" 역할을 하게 될 페이지
 */
export default function HomePage() {
  return (
    <RequireAuth>
      <PageContainer>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>온라인 체스 메인</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white-700">
                이 영역에는 나중에
                <br />
                - 현재 진행 중인 게임,
                <br />
                - 최근 게임 기록,
                <br />
                - 친구/알림 등의 대시보드 요소들이 배치될 예정입니다.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </RequireAuth>
  );
}
