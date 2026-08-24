import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requirePagePermission } from '@/lib/auth/guard';
import { AppPageHeader } from '@/components/app/AppShell';
import { ContentManager } from '@/components/app/ContentManager';

export const metadata: Metadata = { title: 'Content' };
export const dynamic = 'force-dynamic';

export default async function AdminContentPage() {
  const context = await requirePagePermission(['content.edit', 'content.create'], '/admin/content');

  const [resources, courses] = await Promise.all([
    prisma.resource.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        type: true,
        topic: true,
        speaker: true,
        status: true,
        visibility: true,
        publishedAt: true,
        viewCount: true,
        updatedAt: true,
      },
    }),
    prisma.course.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        slug: true,
        title: true,
        track: true,
        summary: true,
        status: true,
        visibility: true,
        publishedAt: true,
        updatedAt: true,
        _count: { select: { lessons: true, progress: true } },
      },
    }),
  ]);

  return (
    <>
      <AppPageHeader
        eyebrow="Admin Portal"
        title="Content"
        description="Sermons, studies, articles, devotionals, prayer guides and discipleship courses."
      />

      <ContentManager
        canCreate={context.permissions.has('content.create')}
        canPublish={context.permissions.has('content.publish')}
        resources={resources.map((resource) => ({
          id: resource.id,
          slug: resource.slug,
          title: resource.title,
          description: resource.description,
          type: resource.type,
          topic: resource.topic,
          speaker: resource.speaker,
          status: resource.status,
          visibility: resource.visibility,
          publishedAt: resource.publishedAt?.toISOString() ?? null,
          viewCount: resource.viewCount,
          updatedAt: resource.updatedAt.toISOString(),
        }))}
        courses={courses.map((course) => ({
          id: course.id,
          slug: course.slug,
          title: course.title,
          track: course.track,
          summary: course.summary,
          status: course.status,
          visibility: course.visibility,
          publishedAt: course.publishedAt?.toISOString() ?? null,
          updatedAt: course.updatedAt.toISOString(),
          lessonCount: course._count.lessons,
          enrolmentCount: course._count.progress,
        }))}
      />
    </>
  );
}
